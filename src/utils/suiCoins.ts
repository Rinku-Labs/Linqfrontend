import { getUsdcCoins } from '../api/swap';

export interface SuiCoinRef {
    coinObjectId: string;
    balance: string;
    version: string;
    digest: string;
}

/**
 * Total USDC balance for a Sui address, via the backend (GET /swap/usdc-coins).
 *
 * Historical note, corrected: an earlier version of this comment claimed the
 * public full node "doesn't support gRPC-Web the way a browser client needs".
 * That was wrong. `fullnode.mainnet.sui.io` answers
 * `sui.rpc.v2.StateService/ListOwnedObjects` over `application/grpc-web+proto`
 * with `access-control-allow-origin: *`; the earlier attempt was a hand-rolled
 * client that couldn't parse the frame format.
 *
 * The real cause of the "no coins found for a wallet that visibly holds coins"
 * bug — on both sides — was a missing gRPC **read mask**. `ListOwnedObjects`
 * defaults to returning only `object_id,version,object_type`, so `digest` and
 * `balance` came back empty and every object was discarded by the parser. The
 * backend (walletHelper.GetObjectsGRPC) now sets that mask explicitly.
 *
 * These helpers stay on the backend proxy so coin selection has one
 * implementation; see utils/suiClient.ts for the browser's own gRPC client,
 * which handles balances, simulation, and execution.
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
