import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../components/TransactionPopup';
import type { RewardsData } from '../api/rewards';

export type FeatureKey = 'predict' | 'invite' | 'save-and-save' | 'multiple-chain' | 'swap';

interface FeatureConfig {
    key: FeatureKey;
    route: string;
}

const FEATURES: FeatureConfig[] = [
    { key: 'predict', route: '/predict' },
    { key: 'invite', route: '/rewards' },
    { key: 'save-and-save', route: '/savings' },
    { key: 'multiple-chain', route: '/' },
    { key: 'swap', route: '/swap' },
];

const STORAGE_KEY = 'linqFeatureDiscoveryClicks';

// The World Cup "Predict & Win" promo takes priority over the normal discovery
// rotation: it's the FIRST popup a user sees, shown until they've interacted with
// it once (clicked or dismissed). After that the usual random rotation resumes.
const PREDICT_SEEN_KEY = 'linqPredictPromoSeen';

function predictPromoSeen(): boolean {
    try {
        return localStorage.getItem(PREDICT_SEEN_KEY) === 'true';
    } catch {
        return false;
    }
}

function markPredictPromoSeen() {
    try {
        localStorage.setItem(PREDICT_SEEN_KEY, 'true');
    } catch { /* ignore */ }
}

function getClickCounts(): Record<FeatureKey, number> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { predict: 0, invite: 0, 'save-and-save': 0, 'multiple-chain': 0, swap: 0 };
}

function setClickCount(feature: FeatureKey, count: number) {
    const counts = getClickCounts();
    counts[feature] = count;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

function getUnusedFeatures(
    orders: Order[],
    rewardsData: RewardsData | null,
    hasSavingsHistory: boolean
): FeatureKey[] {
    const unused: FeatureKey[] = [];

    // Swap: unused if no swap orders
    const hasSwap = orders.some(o => o.orderType?.toLowerCase() === 'swap');
    if (!hasSwap) unused.push('swap');

    // Multi-chain: unused if all orders use only 1 chain
    const chainsUsed = new Set<string>();
    for (const order of orders) {
        if (order.coin) {
            for (const [chain, active] of Object.entries(order.coin)) {
                if (active) chainsUsed.add(chain);
            }
        }
    }
    if (chainsUsed.size <= 1) unused.push('multiple-chain');

    // Savings: unused if no savings history
    if (!hasSavingsHistory) unused.push('save-and-save');

    // Referral: unused if no referrals
    if (!rewardsData || rewardsData.referral.totalReferrals === 0) {
        unused.push('invite');
    }

    return unused;
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function useFeatureDiscovery(
    orders: Order[],
    rewardsData: RewardsData | null,
    hasSavingsHistory: boolean,
    isDataLoaded: boolean
) {
    const navigate = useNavigate();
    const [feature, setFeature] = useState<FeatureKey | null>(null);
    const [showPopup, setShowPopup] = useState(false);

    // Select a feature once data is loaded
    useEffect(() => {
        if (!isDataLoaded) return;

        // Suppress feature discovery popup if the onboarding tour is active
        if (localStorage.getItem('linq_showTour') === 'true') {
            return;
        }

        // Only show popup on every 5th session (sessions 5, 10, 15, …)
        const count = (parseInt(localStorage.getItem('linqSessionCount') || '0', 10)) + 1;
        localStorage.setItem('linqSessionCount', String(count));
        if (count % 5 !== 0) return;

        // World Cup promo comes first: until the user has seen it once, always
        // show it ahead of the normal discovery rotation.
        let selected: FeatureKey;
        if (!predictPromoSeen()) {
            selected = 'predict';
        } else {
            const unused = getUnusedFeatures(orders, rewardsData, hasSavingsHistory);
            const candidates = unused.length > 0 ? unused : FEATURES.map(f => f.key);
            selected = pickRandom(candidates);
        }

        setFeature(selected);
        setShowPopup(true);
    }, [isDataLoaded]); // Only run once when data loads

    const handleClose = useCallback(() => {
        if (feature === 'predict') markPredictPromoSeen();
        setShowPopup(false);
    }, [feature]);

    const handleCtaClick = useCallback(() => {
        if (!feature) return;

        if (feature === 'predict') markPredictPromoSeen();

        const config = FEATURES.find(f => f.key === feature)!;
        const counts = getClickCounts();
        const currentCount = counts[feature] || 0;

        // Always navigate
        setShowPopup(false);

        // The predict page is self-explanatory (own hero + tour), so it never
        // shows the step-by-step explainer.
        if (feature === 'predict') {
            navigate(config.route);
            return;
        }

        if (currentCount < 2) {
            // Increment click count and navigate with explainer flag
            setClickCount(feature, currentCount + 1);
            navigate(config.route, { state: { showFeatureExplainer: feature } });
        } else {
            // Just navigate, no explainer
            navigate(config.route);
        }
    }, [feature, navigate]);

    return {
        feature,
        showPopup,
        handleClose,
        handleCtaClick,
    };
}
