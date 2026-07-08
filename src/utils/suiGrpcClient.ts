import { SuiGrpcClient } from '@mysten/sui/grpc';

// JSON-RPC is deprecated (mainnet public endpoint shutting down the week of
// July 20, full sunset targeted July 2026). Reads (balances, coin lookups) go
// through gRPC — not GraphQL RPC — because GraphQL's General-Purpose Indexer
// backing store can lag well behind chain tip (observed: it returned stale/
// empty results for a coin object right after a transaction touched it,
// while gRPC's stateService — which reads the full node directly, no
// indexer in the path — reflected the correct balance immediately).
// Transaction building/signing/execution still goes through the
// wallet-standard SuiClient (dapp-kit), unaffected by this migration.
export const suiGrpcClient = new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
});
