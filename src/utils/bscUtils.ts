/**
 * Validate BSC/EVM address format
 * BSC addresses are 0x followed by 40 hex characters (20 bytes)
 */
export const isValidBscAddress = (address: string): boolean => {
    if (!address) return false;
    // EVM addresses: 0x + 40 hex chars
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    return evmRegex.test(address);
};

/**
 * BSC does not have a native naming service like ENS
 * This is a placeholder for future integration
 */
export const isValidBscName = (_name: string): boolean => {
    // BSC doesn't have a widely adopted naming service
    // Could integrate with Space ID in the future
    return false;
};

/**
 * Resolve BSC name to address (placeholder)
 */
export const resolveBscName = async (_name: string): Promise<string | null> => {
    // No native naming service for BSC
    // Could integrate with Space ID (.bnb names) in the future
    return null;
};

// BSC USDC contract address (Binance-Peg USD Coin)
export const BSC_USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
