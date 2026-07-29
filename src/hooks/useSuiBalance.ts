import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import type { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * A coin balance for an address, in the coin's base units (USDC has 6
 * decimals, so `1000000` is $1.00).
 *
 * Replaces `useSuiClientQuery('getBalance', ...)`. That hook is typed and named
 * against the JSON-RPC client, whose `getBalance` returned `{ totalBalance }`
 * and is now dead on the public full nodes — it answered `-32601 Method not
 * found`, which is exactly why every wallet rendered `0.00`. The gRPC client's
 * `getBalance` returns `{ balance: { balance } }` instead, so the shape is
 * normalised here rather than at each call site.
 */
export function useSuiCoinBalance(
    owner: string | undefined,
    coinType: string,
    enabled = true,
) {
    // dapp-kit@1.1.3 types the context client as `SuiJsonRpcClient`; main.tsx
    // installs a `SuiGrpcClient` through the provider's `createClient` hook.
    const client = useSuiClient() as unknown as SuiGrpcClient;

    return useQuery({
        queryKey: ['sui', 'balance', owner ?? null, coinType],
        enabled: enabled && !!owner,
        queryFn: async (): Promise<bigint> => {
            const { balance } = await client.getBalance({ owner: owner as string, coinType });
            return BigInt(balance.balance);
        },
    });
}

/** Base-unit balance as a decimal number, e.g. `1000000n` USDC -> `1`. */
export function toDecimal(baseUnits: bigint | undefined, decimals = 6): number {
    if (baseUnits === undefined) return 0;
    return Number(baseUnits) / 10 ** decimals;
}
