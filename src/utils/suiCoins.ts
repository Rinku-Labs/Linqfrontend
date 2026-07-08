import { getUsdcCoins } from '../api/swap';

export interface SuiCoinRef {
    coinObjectId: string;
    balance: string;
}

/**
 * Total USDC balance for a Sui address, via the backend (GET /swap/usdc-coins).
 *
 * This used to call Sui's public JSON-RPC / GraphQL RPC / gRPC endpoints
 * directly from the browser. All three showed real, reproducible gaps
 * enumerating coin objects for an owner+type — including cases where a coin
 * object was confirmed to exist on-chain (via a block explorer, and via the
 * aggregate balance field on the same endpoint) but never showed up in a
 * "list objects owned by X" query. Direct browser gRPC also isn't viable:
 * Sui's public full node doesn't support gRPC-Web the way a browser client
 * needs (confirmed by inspecting the raw network response — undecoded
 * gRPC-Web frames the client couldn't parse). The backend's gRPC client
 * (walletHelper.GetObjectsGRPC, Go) already handles this reliably — it's
 * what fixed the same class of bug in the offramp/onramp payout path.
 */
export async function getTotalBalance(owner: string): Promise<number> {
    const { totalBalance } = await getUsdcCoins(owner);
    return Number(totalBalance);
}

/** Fetches every USDC coin object owned by `owner`, via the backend. */
export async function getAllCoins(owner: string): Promise<SuiCoinRef[]> {
    const { coins } = await getUsdcCoins(owner);
    return coins;
}
