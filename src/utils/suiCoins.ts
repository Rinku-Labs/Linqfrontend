import type { SuiGrpcClient } from '@mysten/sui/grpc';

export interface SuiCoinRef {
    coinObjectId: string;
    balance: string;
}

/**
 * Total balance for a coin type, aggregated server-side by the indexer.
 * Use this for sufficiency checks instead of summing a single listCoins()
 * page — listCoins only returns one page per call, so summing it directly
 * undercounts any wallet with more coin objects than that, silently
 * reporting a much lower balance than the wallet actually holds.
 */
export async function getTotalBalance(client: SuiGrpcClient, owner: string, coinType: string): Promise<number> {
    const { balance } = await client.core.getBalance({ owner, coinType });
    return Number(balance.balance);
}

/** Fetches every coin object of `coinType` owned by `owner`, following pagination to completion. */
export async function getAllCoins(client: SuiGrpcClient, owner: string, coinType: string): Promise<SuiCoinRef[]> {
    const coins: SuiCoinRef[] = [];
    let cursor: string | null | undefined;

    do {
        const page = await client.core.listCoins({ owner, coinType, cursor });
        coins.push(...page.objects.map((o) => ({ coinObjectId: o.objectId, balance: o.balance })));
        cursor = page.hasNextPage ? page.cursor : null;
    } while (cursor);

    return coins;
}
