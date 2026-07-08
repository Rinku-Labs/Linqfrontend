import { SuiGraphQLClient } from '@mysten/sui/graphql';

// JSON-RPC is deprecated (mainnet public endpoint shutting down the week of
// July 20, full sunset targeted July 2026). Reads (balances, coin lookups) go
// through GraphQL RPC, not gRPC — Sui's own docs recommend GraphQL for
// frontends and gRPC for backends only. Confirmed empirically too: the
// browser can't reliably speak gRPC directly to the public full node
// (SuiGrpcClient's browser transport got back undecoded gRPC-Web frames the
// client couldn't parse — the public endpoint isn't set up for browser
// gRPC-Web, only server-to-server gRPC). Transaction building/signing/
// execution still go through the wallet-standard SuiClient (dapp-kit),
// unaffected by this migration.
export const suiGraphQLClient = new SuiGraphQLClient({
    network: 'mainnet',
    url: 'https://graphql.mainnet.sui.io/graphql',
});
