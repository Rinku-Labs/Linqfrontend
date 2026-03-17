import { SuinsClient } from '@mysten/suins';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

// Initialize Sui Client
const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Initialize Suins Client
const suinsClient = new SuinsClient({
    client: suiClient,
    network: 'mainnet',
});

export const resolveSuinsName = async (name: string): Promise<string | null> => {
    try {
        if (!name.endsWith('.sui')) return null;

        const record = await suinsClient.getNameRecord(name);
        return (record as any)?.value || (record as any)?.targetAddress || null;
    } catch (error) {
        console.error('Error resolving SuiNS name:', error);
        return null;
    }
};

export const isValidSuinsName = (name: string): boolean => {
    return name.toLowerCase().endsWith('.sui');
};
