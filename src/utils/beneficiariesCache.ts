import { getBeneficiaries, addBeneficiary, deleteBeneficiary, type BeneficiaryData, type AddBeneficiaryPayload } from '../api/user';

const CACHE_KEY = 'cachedBeneficiaries';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

interface CachedBeneficiaries {
    data: BeneficiaryData[];
    timestamp: number;
}

// ─── Read / Write Cache ─────────────────────────────────────────

export const getCachedBeneficiaries = (): CachedBeneficiaries | null => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    try {
        const cached: CachedBeneficiaries = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_DURATION_MS) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cached;
    } catch {
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
};

export const setCachedBeneficiaries = (data: BeneficiaryData[]) => {
    const cached: CachedBeneficiaries = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
};

// ─── Fetch with cache ───────────────────────────────────────────

/**
 * Returns beneficiaries from cache if fresh, otherwise fetches from API.
 * Pass forceRefresh=true to always hit the API.
 */
export const fetchAndCacheBeneficiaries = async (forceRefresh = false): Promise<BeneficiaryData[]> => {
    if (!forceRefresh) {
        const cached = getCachedBeneficiaries();
        if (cached) {
            // Deduplicate corrupted cache just in case
            const seen = new Set<string>();
            const uniqueData = cached.data.filter(b => {
                const key = `${b.bankAccount}-${b.bankCode}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            return uniqueData;
        }
    }

    try {
        const response = await getBeneficiaries();
        const data = response.data || [];
        setCachedBeneficiaries(data);
        return data;
    } catch {
        return [];
    }
};

// ─── Mutate + keep cache in sync ────────────────────────────────

/**
 * Adds a beneficiary via the API and appends to the cache without re-fetching.
 */
export const addBeneficiaryAndUpdateCache = async (payload: AddBeneficiaryPayload): Promise<BeneficiaryData> => {
    try {
        const response = await addBeneficiary(payload);
        const newEntry = response.data;
        // Append to cache
        const cached = getCachedBeneficiaries();
        const currentData = cached?.data || [];
        
        // Prevent duplicate entries in cache by filtering out matches
        const withoutDuplicate = currentData.filter(b => 
            !(b.bankAccount === newEntry.bankAccount && b.bankCode === newEntry.bankCode)
        );
        
        setCachedBeneficiaries([newEntry, ...withoutDuplicate]);
        return newEntry;
    } catch (error: unknown) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 409) {
            const refreshed = await fetchAndCacheBeneficiaries(true);
            const existing = refreshed.find((beneficiary) =>
                beneficiary.bankCode === payload.bankCode &&
                beneficiary.bankAccount === payload.bankAccount
            );
            if (existing) return existing;
        }

        throw error;
    }
};

/**
 * Deletes a beneficiary via the API and removes from the cache without re-fetching.
 */
export const deleteBeneficiaryAndUpdateCache = async (id: number): Promise<boolean> => {
    try {
        await deleteBeneficiary(id);
        // Remove from cache
        const cached = getCachedBeneficiaries();
        if (cached) {
            setCachedBeneficiaries(cached.data.filter(b => b.id !== id));
        }
        return true;
    } catch {
        return false;
    }
};

// ─── Invalidate ─────────────────────────────────────────────────

export const invalidateBeneficiariesCache = () => {
    localStorage.removeItem(CACHE_KEY);
};
