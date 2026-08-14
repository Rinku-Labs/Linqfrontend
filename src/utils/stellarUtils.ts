import {
    Asset,
    BASE_FEE,
    Horizon,
    Networks,
    Operation,
    StrKey,
    TransactionBuilder,
} from '@stellar/stellar-sdk';

/**
 * Stellar USDC configuration.
 *
 * The issuer is read from the environment because the testnet issuer differs
 * from Circle's mainnet one — hard-coding it would compile the wrong asset into
 * a testnet build.
 */
export const STELLAR_USDC_CODE = 'USDC';
export const STELLAR_USDC_ISSUER =
    import.meta.env.VITE_STELLAR_USDC_ISSUER ||
    'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export const STELLAR_NETWORK_PASSPHRASE =
    import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || Networks.PUBLIC;

const STELLAR_HORIZON_URL =
    import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon.stellar.org';

export const stellarUsdc = () => new Asset(STELLAR_USDC_CODE, STELLAR_USDC_ISSUER);

const server = () => new Horizon.Server(STELLAR_HORIZON_URL);

/**
 * Validate a Stellar address.
 *
 * Muxed (M...) addresses are deliberately rejected: the backend's deposit and
 * payout paths only handle plain ed25519 accounts.
 */
export const isValidStellarAddress = (address: string): boolean => {
    if (!address) return false;
    try {
        return StrKey.isValidEd25519PublicKey(address);
    } catch {
        return false;
    }
};

/**
 * Convert a number to a Stellar payment amount.
 *
 * Stellar amounts are decimal STRINGS with at most 7 decimal places — the SDK
 * multiplies by 10,000,000 internally. Do NOT scale the value first the way the
 * Sui/Solana/EVM handlers in this app do: passing base units here is accepted
 * without error and sends ten million times the intended amount.
 *
 * The toFixed(7) is not cosmetic. The app's fee maths produces values such as
 * 124.37587500000001, which Stellar rejects outright for having more than 7
 * decimal places.
 */
export const toStellarAmount = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid Stellar amount: ${value}`);
    }
    return value.toFixed(7);
};

/** Read a USDC balance from Horizon, which reports it already in decimal form. */
export const getStellarUsdcBalance = async (address: string): Promise<number> => {
    if (!isValidStellarAddress(address)) return 0;
    try {
        const account = await server().loadAccount(address);
        const line = account.balances.find(
            (b) =>
                'asset_code' in b &&
                b.asset_code === STELLAR_USDC_CODE &&
                'asset_issuer' in b &&
                b.asset_issuer === STELLAR_USDC_ISSUER,
        );
        if (!line) return 0;
        return parseFloat(line.balance) || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // A 404 means the account has not been created on-chain yet, which for
        // balance purposes is simply zero.
        if (error?.response?.status === 404) return 0;
        throw error;
    }
};

/**
 * Send USDC on Stellar.
 *
 * `signXdr` comes from the connected wallet. The savings transfer is bundled as
 * a second operation in the same transaction, so unlike Aptos/BSC/Base/Tron it
 * cannot half-succeed and only needs one signature.
 */
export const buildStellarUsdcPayment = async (params: {
    from: string;
    to: string;
    amount: number;
    savingsAddress?: string;
    savingsAmount?: number;
    signXdr: (xdr: string) => Promise<string>;
}): Promise<string> => {
    const { from, to, amount, savingsAddress, savingsAmount, signXdr } = params;

    if (!isValidStellarAddress(to)) {
        throw new Error('Invalid Stellar destination address');
    }

    const horizon = server();
    const usdc = stellarUsdc();
    const source = await horizon.loadAccount(from);

    const builder = new TransactionBuilder(source, {
        fee: String(Number(BASE_FEE) * 100), // headroom for surge pricing
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    }).addOperation(
        Operation.payment({
            destination: to,
            asset: usdc,
            amount: toStellarAmount(amount),
        }),
    );

    if (savingsAddress && isValidStellarAddress(savingsAddress) && savingsAmount && savingsAmount > 0) {
        builder.addOperation(
            Operation.payment({
                destination: savingsAddress,
                asset: usdc,
                amount: toStellarAmount(savingsAmount),
            }),
        );
    }

    const tx = builder.setTimeout(180).build();
    const signedXdr = await signXdr(tx.toXDR());

    const signed = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
    const result = await horizon.submitTransaction(signed);
    return result.hash;
};

/** Turn a Stellar failure into something a user can act on. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const describeStellarError = (error: any): string => {
    const codes = error?.response?.data?.extras?.result_codes;
    const ops: string[] = codes?.operations || [];
    const tx: string = codes?.transaction || '';

    if (ops.includes('op_no_destination')) {
        return "This deposit address isn't ready yet. Give it a few seconds and try again.";
    }
    if (ops.includes('op_no_trust')) {
        return "This deposit address can't receive USDC yet. Please try again in a moment.";
    }
    if (ops.includes('op_not_authorized')) {
        return 'This address is not authorised to hold USDC.';
    }
    if (ops.includes('op_underfunded')) {
        return 'Insufficient USDC balance for this transfer.';
    }
    if (tx === 'tx_insufficient_fee') {
        return 'The Stellar network is busy right now. Please try again.';
    }
    if (tx === 'tx_bad_seq') {
        return 'Something went out of sync — please try again.';
    }
    if (tx === 'tx_insufficient_balance') {
        return 'Your Stellar account needs a little more XLM to cover the network fee.';
    }

    const message = error?.message || '';
    const lower = message.toLowerCase();
    if (lower.includes('reject') || lower.includes('cancel') || lower.includes('denied')) {
        return 'Transaction was cancelled or rejected.';
    }
    return message || 'Stellar transaction failed.';
};
