import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useChain } from './ChainContext';
import client from '../api/client';
import {
    getSavingsConfig,
    setSavingsConfig as persistConfig,
    generateEntryId,
} from '../utils/savingsConfig';
import type { SavingsConfig, SavingsEntry } from '../utils/savingsConfig';

interface SavingsContextType {
    config: SavingsConfig;
    updateConfig: (config: Partial<SavingsConfig>) => void;
    history: SavingsEntry[];
    totalSaved: number;
    addEntry: (entry: Omit<SavingsEntry, 'id' | 'createdAt'>) => void;
    refreshHistory: () => void;
}

const SavingsContext = createContext<SavingsContextType | undefined>(undefined);

export function SavingsProvider({ children }: { children: React.ReactNode }) {
    const { selectedChain } = useChain();
    const [config, setConfig] = useState<SavingsConfig>(() => getSavingsConfig(selectedChain));
    const [history, setHistory] = useState<SavingsEntry[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [, setIsLoadingHistory] = useState(false);

    const updateConfig = useCallback((partial: Partial<SavingsConfig>) => {
        setConfig(prev => {
            const updated = { ...prev, ...partial };
            persistConfig(selectedChain, updated);
            return updated;
        });
    }, [selectedChain]);

    const fetchHistory = useCallback(async () => {
        const token = localStorage.getItem('linqAuthToken');
        if (!token) return;

        const now = Date.now();
        const thirtyMins = 30 * 60 * 1000;
        let requestTimestamps: number[] = [];

        try {
            const stored = localStorage.getItem('savingsHistoryRateLimit');
            if (stored) {
                requestTimestamps = JSON.parse(stored);
            }
        } catch (e) {
            // ignore parse error
        }

        // Clean up timestamps older than 30 minutes
        requestTimestamps = requestTimestamps.filter(t => now - t < thirtyMins);

        if (requestTimestamps.length >= 5) {
            console.warn('Rate limit exceeded: Please wait before checking savings history again.');
            return;
        }

        // Record this new request
        requestTimestamps.push(now);
        localStorage.setItem('savingsHistoryRateLimit', JSON.stringify(requestTimestamps));

        setIsLoadingHistory(true);
        try {
            const res = await client.get('/savings/history');
            const data = res.data;
            const fullHistory: SavingsEntry[] = data.history || [];

            // Filter history by current chain
            const chainHistory = fullHistory.filter((e: any) => e.chain.toUpperCase() === selectedChain.toUpperCase());
            setHistory(chainHistory);

            // Total is computed entirely by backend across all chains,
            // but for context we might want to sum just for this chain specifically
            // Or use the backend total if we change the backend to per chain.
            // Let's compute precisely for this chain locally based on the returned history
            const chainTotal = chainHistory
                .filter(e => e.status === 'completed')
                .reduce((acc, curr) => acc + curr.amount, 0);
            setTotal(chainTotal);

            // Auto-fill address logic
            // If config doesn't have an address currently enabled, pull from the most recent history entry for this chain
            if (chainHistory.length > 0) {
                const latestAddress = chainHistory[0].savingsAddress;
                setConfig(prev => {
                    const savedLocalConfig = getSavingsConfig(selectedChain);
                    // Only auto-enable if we never configured it before on this device
                    if (!savedLocalConfig.savingsAddress && latestAddress) {
                        const newConfig = { ...prev, savingsAddress: latestAddress, enabled: true };
                        persistConfig(selectedChain, newConfig);
                        return newConfig;
                    }
                    return prev;
                });
            }
        } catch {
            // savings history unavailable (e.g. rate limited) — keep previous state
        } finally {
            setIsLoadingHistory(false);
        }
    }, [selectedChain]);

    // Reload when chain changes
    useEffect(() => {
        setConfig(getSavingsConfig(selectedChain));
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChain]);

    const addEntry = useCallback((entry: Omit<SavingsEntry, 'id' | 'createdAt'>) => {
        // Optimistically add to state to avoid full refetch delay on UX
        const full: SavingsEntry = {
            ...entry,
            id: generateEntryId(),
            createdAt: new Date().toISOString(),
        };
        setHistory(prev => [full, ...prev]);
        if (full.status === 'completed') {
            setTotal(prev => prev + full.amount);
        }

        // Also fire off a background refetch to sync precisely with the backend
        setTimeout(() => fetchHistory(), 3000);
    }, [fetchHistory]);

    const refreshHistory = useCallback(() => {
        fetchHistory();
    }, [fetchHistory]);

    return (
        <SavingsContext.Provider value={{ config, updateConfig, history, totalSaved: total, addEntry, refreshHistory }}>
            {children}
        </SavingsContext.Provider>
    );
}

export function useSavings() {
    const context = useContext(SavingsContext);
    if (context === undefined) {
        throw new Error('useSavings must be used within a SavingsProvider');
    }
    return context;
}
