import { suins } from '@mysten/suins';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

// Initialize Sui Client extended with SuiNS resolution
const suinsClient = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl('mainnet'),
    network: 'mainnet',
}).$extend(suins());

export const resolveSuinsName = async (name: string): Promise<string | null> => {
    try {
        if (!name.endsWith('.sui')) return null;

        const record = await suinsClient.suins.getNameRecord(name);
        return (record as any)?.value || (record as any)?.targetAddress || null;
    } catch (error) {
        console.error('Error resolving SuiNS name:', error);
        return null;
    }
};

export const isValidSuinsName = (name: string): boolean => {
    return name.toLowerCase().endsWith('.sui');
};
