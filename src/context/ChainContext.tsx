import React, { createContext, useContext, useState } from 'react';

export type Chain = 'SUI' | 'SOLANA' | 'APTOS' | 'BSC' | 'BASE' | 'TRON' | 'STELLAR';

export const HIDE_APTOS = true;
export const HIDE_TRON = true;

interface ChainContextType {
    selectedChain: Chain;
    setSelectedChain: (chain: Chain) => void;
}

const ChainContext = createContext<ChainContextType | undefined>(undefined);

export function ChainProvider({ children }: { children: React.ReactNode }) {
    const [selectedChain, setSelectedChainState] = useState<Chain>(() => {
        const saved = localStorage.getItem('selectedChain') as Chain | null;
        if (!saved) return 'SUI';

        const isHidden = (saved === 'APTOS' && HIDE_APTOS) || (saved === 'TRON' && HIDE_TRON);
        if (isHidden) return 'SUI';

        const isValid = ['SUI', 'SOLANA', 'APTOS', 'BSC', 'BASE', 'TRON', 'STELLAR'].includes(saved);
        return isValid ? saved : 'SUI';
    });

    const setSelectedChain = (chain: Chain) => {
        setSelectedChainState(chain);
        localStorage.setItem('selectedChain', chain);
    };

    return (
        <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
            {children}
        </ChainContext.Provider>
    );
}

export function useChain() {
    const context = useContext(ChainContext);
    if (context === undefined) {
        throw new Error('useChain must be used within a ChainProvider');
    }
    return context;
}
