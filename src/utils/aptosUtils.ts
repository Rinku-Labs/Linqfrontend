import { aptos } from './aptosClient';

/**
 * Validate Aptos address format
 * Aptos addresses are 0x followed by 64 hex characters (32 bytes)
 */
export const isValidAptosAddress = (address: string): boolean => {
    if (!address) return false;
    // Aptos addresses: 0x + 64 hex chars (but can be shorter with leading zeros omitted)
    const aptosRegex = /^0x[a-fA-F0-9]{1,64}$/;
    return aptosRegex.test(address);
};

/**
 * Check if the input is a valid Aptos Name Service (.apt) name
 */
export const isValidAptosName = (name: string): boolean => {
    return name.toLowerCase().endsWith('.apt');
};

/**
 * Resolve Aptos Name Service name to address
 * Note: ANS resolution requires the Aptos SDK
 */
export const resolveAptosName = async (name: string): Promise<string | null> => {
    if (!isValidAptosName(name)) return null;

    try {
        const address = await aptos.ans.getOwnerAddress({ name: name.replace('.apt', '') });
        return address ? address.toString() : null;
    } catch (error) {
        console.error('Error resolving Aptos name:', error);
        return null;
    }
};
