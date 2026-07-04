import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export interface SuiCoinRef {
    coinObjectId: string;
    balance: string;
}

/**
 * Total balance for a coin type, aggregated server-side by the RPC node.
 * Use this for sufficiency checks instead of summing a single getCoins()
 * page — getCoins only returns one page (default 50 objects) per call, so
 * summing it directly undercounts any wallet with more coin objects than
 * that, silently reporting a much lower balance than the wallet actually
 * holds.
 */
export async function getTotalBalance(client: SuiJsonRpcClient, owner: string, coinType: string): Promise<number> {
    const { totalBalance } = await client.getBalance({ owner, coinType });
    return Number(totalBalance);
}

/** Fetches every coin object of `coinType` owned by `owner`, following pagination to completion. */
export async function getAllCoins(client: SuiJsonRpcClient, owner: string, coinType: string): Promise<SuiCoinRef[]> {
    const coins: SuiCoinRef[] = [];
    let cursor: string | null | undefined;

    do {
        const page = await client.getCoins({ owner, coinType, cursor });
        coins.push(...page.data);
        cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor);

    return coins;
}
