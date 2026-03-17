import React, { useMemo } from 'react';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';

export function TronWalletProvider({ children }: { children: React.ReactNode }) {
    const adapters = useMemo(() => [], []);

    return (
        <WalletProvider adapters={adapters} autoConnect={false}>
            {children}
        </WalletProvider>
    );
}
