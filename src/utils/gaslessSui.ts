import { Transaction } from '@mysten/sui/transactions';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

/**
 * Stablecoins eligible for Sui's native gasless transfer feature
 * (`0x2::balance::send_funds`). Mirrors the protocol-governed allowlist from
 * the Sui docs (`get_gasless_allowed_token_types`) — subject to change across
 * protocol versions, so treat this as a snapshot, not a guarantee.
 */
export const GASLESS_ELIGIBLE_COINS: Record<string, string> = {
    USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    USDSUI: '0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI',
    SUI_USDE: '0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE',
    USDY: '0x960b531667636f39e85867775f52f6b1f220a058c4de786905bdf761e06a56bb::usdy::USDY',
    FDUSD: '0xf16e6b723f242ec745dfd7634ad072c42d5c1d9ac9d62a39c381303eaa57693a::fdusd::FDUSD',
    AUSD: '0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD',
    USDB: '0xe14726c336e81b32328e92afc37345d159f5b550b09fa92bd43640cfdd0a0cfd::usdb::USDB',
};

/** Gasless transfers below this amount are rejected by the protocol. */
export const GASLESS_MIN_AMOUNT = 0.01;

export function isGaslessEligible(coinType: string, amount: number): boolean {
    return Object.values(GASLESS_ELIGIBLE_COINS).includes(coinType) && amount >= GASLESS_MIN_AMOUNT;
}

export interface GaslessTransfer {
    coinType: string;
    amountRaw: bigint;
    recipient: string;
}

/**
 * Builds a PTB of one or more `0x2::balance::send_funds` calls — the shape
 * required for Sui's native gasless stablecoin transfers. Uses `tx.balance()`
 * so funds are sourced from address balance or owned coin objects
 * automatically, with no manual getCoins/mergeCoins/splitCoins needed.
 *
 * gasPrice/gasPayment are set explicitly per the documented JSON-RPC fallback
 * recipe (this app's SuiClient is JSON-RPC only) rather than relying on the
 * SDK to auto-detect eligibility during build. Callers must only invoke this
 * for transfers that already passed `isGaslessEligible`.
 */
export function buildGaslessTransferTx(sender: string, transfers: GaslessTransfer[]): Transaction {
    const tx = new Transaction();
    tx.setSender(sender);

    for (const { coinType, amountRaw, recipient } of transfers) {
        tx.moveCall({
            target: '0x2::balance::send_funds',
            typeArguments: [coinType],
            arguments: [tx.balance({ type: coinType, balance: amountRaw }), tx.pure.address(recipient)],
        });
    }

    tx.setGasPrice(0);
    tx.setGasPayment([]);

    return tx;
}

/**
 * Builds and dry-runs a gasless transfer tx against the live node before ever
 * asking the user to sign — throws if the node rejects it (e.g. it turns out
 * not to qualify for gasless treatment), so the caller can fall back to the
 * legacy self-pay flow without ever requesting a second signature.
 */
export async function verifyGaslessTransaction(client: SuiJsonRpcClient, tx: Transaction): Promise<void> {
    const transactionBlock = await tx.build({ client });
    const dryRun = await client.dryRunTransactionBlock({ transactionBlock });
    if (dryRun.effects.status.status !== 'success') {
        throw new Error(dryRun.effects.status.error || 'Gasless transfer simulation failed');
    }
}
