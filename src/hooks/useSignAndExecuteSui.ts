import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { fromBase64 } from '@mysten/sui/utils';
import type { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * `useSignAndExecuteTransaction`, executing over gRPC instead of JSON-RPC.
 *
 * dapp-kit's default `execute` calls `client.executeTransactionBlock(...)` — a
 * JSON-RPC method that the public full nodes no longer serve and that
 * `SuiGrpcClient` does not implement at all. Every Sui payment in the app went
 * through that default, so signing appeared to "not work": the wallet either
 * never got prompted (the build step below failed first) or the submit that
 * followed the signature threw.
 *
 * The `execute` override is dapp-kit's supported seam for exactly this. The
 * wallet still does the signing; only submission moves to gRPC.
 */
export function useSignAndExecuteSuiTransaction() {
    // main.tsx installs a SuiGrpcClient via SuiClientProvider's `createClient`;
    // dapp-kit@1.1.3 just types the context client as the JSON-RPC one.
    const client = useSuiClient() as unknown as SuiGrpcClient;

    return useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) => {
            const result = await client.executeTransaction({
                transaction: fromBase64(bytes),
                signatures: [signature],
                include: { effects: true },
            });

            if (result.$kind === 'FailedTransaction') {
                const { error } = result.FailedTransaction.status;
                throw new Error(error?.message || 'Transaction failed on-chain');
            }

            return { digest: result.Transaction.digest };
        },
    });
}
