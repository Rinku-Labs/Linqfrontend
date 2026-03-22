import client from '../api/client';

const CACHE_KEY = 'cachedRate';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ERROR_BACKOFF_MS = 60 * 1000; // 60 seconds — suppress re-fetching after an error
const FALLBACK_RATE = 1460; // Default fallback rate

interface CachedRate {
    rate: number;
    timestamp: number;
}

let inMemoryRate: CachedRate | null = null;
let lastErrorTime: number = 0; // Track when the last API error occurred
let inflightPromise: Promise<number> | null = null; // De-duplication: reuse in-flight request

export const getCachedRate = (): number | null => {
    // Check in-memory cache first
    if (inMemoryRate && Date.now() - inMemoryRate.timestamp < CACHE_DURATION_MS) {
        return inMemoryRate.rate;
    }

    // Check localStorage
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    try {
        const data: CachedRate = JSON.parse(cached);
        if (Date.now() - data.timestamp > CACHE_DURATION_MS) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        // Populate in-memory cache
        inMemoryRate = data;
        return data.rate;
    } catch {
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
};

const setCachedRate = (rate: number) => {
    const data: CachedRate = { rate, timestamp: Date.now() };
    inMemoryRate = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
};

/**
 * Returns the last known good rate, even if expired.
 * Falls back to FALLBACK_RATE if no rate was ever cached.
 */
const getLastKnownRate = (): number => {
    if (inMemoryRate) return inMemoryRate.rate;

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const data: CachedRate = JSON.parse(cached);
            return data.rate;
        } catch {
            // ignore
        }
    }

    return FALLBACK_RATE;
};

export const fetchRate = async (forceRefresh = false): Promise<number> => {
    // Return cached rate if still fresh (unless force-refreshing)
    if (!forceRefresh) {
        const cached = getCachedRate();
        if (cached !== null) {
            return cached;
        }
    }

    // Error backoff: if the API failed recently, return the last known rate
    if (lastErrorTime && Date.now() - lastErrorTime < ERROR_BACKOFF_MS) {
        return getLastKnownRate();
    }

    // De-duplication: if a fetch is already in-flight, wait for it
    if (inflightPromise) {
        return inflightPromise;
    }

    // Fetch from API
    inflightPromise = (async () => {
        try {
            const response = await client.get('/rate');
            let rate = 0;

            if (response.data && typeof response.data === 'number') {
                rate = response.data;
            } else if (response.data?.rate) {
                rate = response.data.rate;
            }

            if (rate > 0) {
                setCachedRate(rate);
                lastErrorTime = 0; // Clear error state on success
                return rate;
            }

            // API returned 0 or invalid — treat as soft error
            return getLastKnownRate();
        } catch {
            // API error — activate backoff, return last known rate
            lastErrorTime = Date.now();
            return getLastKnownRate();
        } finally {
            inflightPromise = null;
        }
    })();

    return inflightPromise;
};

export const invalidateRateCache = () => {
    inMemoryRate = null;
    lastErrorTime = 0;
    localStorage.removeItem(CACHE_KEY);
};
