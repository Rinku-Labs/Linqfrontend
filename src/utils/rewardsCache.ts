import type { RewardsData } from '../api/rewards';

const CACHE_KEY = 'cachedRewardsData';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedRewards {
    data: RewardsData;
    timestamp: number;
}

export function getCachedRewards(): RewardsData | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached: CachedRewards = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cached.data;
    } catch {
        return null;
    }
}

export function setCachedRewards(data: RewardsData): void {
    try {
        const entry: CachedRewards = { data, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch { /* ignore quota errors */ }
}

export function invalidateRewardsCache(): void {
    localStorage.removeItem(CACHE_KEY);
}
