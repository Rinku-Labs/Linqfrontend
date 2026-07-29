import { suins } from '@mysten/suins';
import { createSuiGrpcClient } from './suiClient';

// Initialize Sui Client extended with SuiNS resolution. gRPC, not JSON-RPC —
// the public full nodes stopped serving JSON-RPC, so name lookups threw
// "Method not found" and every .sui recipient failed to resolve.
const suinsClient = createSuiGrpcClient().$extend(suins());

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
