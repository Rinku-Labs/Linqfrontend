import { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * The app's Sui transport.
 *
 * Sui deprecated JSON-RPC on the public full nodes: every `suix_*` / `sui_*`
 * method now answers `-32601 Method not found`. That killed balance reads,
 * dry runs, gas/object resolution during `tx.build()`, and transaction
 * execution — i.e. every Sui code path in this app, not just the ones that
 * enumerate coins.
 *
 * gRPC-Web is the supported browser transport and it does work against the
 * public full node: `fullnode.mainnet.sui.io` answers
 * `sui.rpc.v2.StateService/GetBalance` over `application/grpc-web+proto` with
 * `access-control-allow-origin: *`, so there is no CORS or proxy problem. (An
 * earlier note in this repo claimed browser gRPC-Web was unsupported; that was
 * a hand-rolled client failing to parse the framing, not the node refusing it.
 * `@mysten/sui/grpc` ships a `@protobuf-ts` gRPC-Web transport that handles it.)
 */
export const SUI_NETWORK = 'mainnet' as const;

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

/**
 * Full node gRPC endpoints. The `:443` is explicit because the gRPC-Web
 * transport builds absolute URLs and the port is part of what the node's
 * routing keys on.
 */
export function getSuiGrpcUrl(network: SuiNetwork): string {
    return `https://fullnode.${network}.sui.io:443`;
}

export function createSuiGrpcClient(network: SuiNetwork = SUI_NETWORK): SuiGrpcClient {
    return new SuiGrpcClient({ network, baseUrl: getSuiGrpcUrl(network) });
}

/**
 * Shared client for module-scope callers that sit outside React (SuiNS
 * resolution, coin helpers). Components should prefer `useSuiClient()` so they
 * follow the provider's selected network.
 */
export const suiClient = createSuiGrpcClient();
