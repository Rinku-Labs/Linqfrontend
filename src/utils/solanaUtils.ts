import { Connection, PublicKey } from '@solana/web3.js';
import { getDomainKeySync, NameRegistryState } from '@bonfida/spl-name-service';

export const isValidSolanaAddress = (address: string): boolean => {
    try {
        new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
};

export const isValidSnsName = (name: string): boolean => {
    return name.toLowerCase().endsWith('.sol');
};

export const resolveSolanaName = async (name: string): Promise<string | null> => {
    if (!isValidSnsName(name)) return null;

    try {
        // Use a public RPC endpoint or one from environment variables if available
        // Use a public RPC endpoint or one from environment variables if available
        const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"; // helius implemented
        const connection = new Connection(rpcUrl);

        const { pubkey } = getDomainKeySync(name);
        const { registry } = await NameRegistryState.retrieve(connection, pubkey);

        if (registry.owner) {
            return registry.owner.toBase58();
        }
        return null;
    } catch (error) {
        // If the domain doesn't exist, retrieve will throw
        return null;
    }
};
