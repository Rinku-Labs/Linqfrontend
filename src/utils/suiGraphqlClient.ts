import { SuiGraphQLClient } from '@mysten/sui/graphql';

// JSON-RPC is deprecated (full sunset targeted for July 2026, public mainnet
// endpoint shutting down the week of July 20). Reads (balances, coin lookups)
// go through GraphQL RPC instead; transaction building/signing/execution
// still goes through the wallet-standard SuiClient (dapp-kit) unaffected by
// this migration.
export const suiGraphQLClient = new SuiGraphQLClient({
    network: 'mainnet',
    url: 'https://graphql.mainnet.sui.io/graphql',
});
