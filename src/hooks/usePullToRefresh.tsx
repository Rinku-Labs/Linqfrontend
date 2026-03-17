import React, { useState, useCallback, useRef } from 'react';

interface PullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
}

interface PullToRefreshReturn {
    isRefreshing: boolean;
    pullDistance: number;
    handlers: {
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchMove: (e: React.TouchEvent) => void;
        onTouchEnd: () => void;
    };
}

export default function usePullToRefresh({
    onRefresh,
    threshold = 80,
}: PullToRefreshOptions): PullToRefreshReturn {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const startY = useRef(0);
    const isPulling = useRef(false);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        // Only start if scrolled to top
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        if (scrollTop <= 0 && !isRefreshing) {
            startY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, [isRefreshing]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Apply resistance - the further you pull, the harder it gets
            const resistance = 0.4;
            setPullDistance(Math.min(diff * resistance, threshold * 1.5));
        }
    }, [isRefreshing, threshold]);

    const onTouchEnd = useCallback(async () => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold * 0.6); // Snap to loading position
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [pullDistance, threshold, isRefreshing, onRefresh]);

    return {
        isRefreshing,
        pullDistance,
        handlers: {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
        },
    };
}

/** Visual indicator component for pull-to-refresh */
export function PullToRefreshIndicator({
    pullDistance,
    isRefreshing,
    threshold = 80,
}: {
    pullDistance: number;
    isRefreshing: boolean;
    threshold?: number;
}) {
    if (pullDistance <= 0 && !isRefreshing) return null;

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 360;
    const isTriggered = pullDistance >= threshold;


    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: `${pullDistance}px`,
            overflow: 'hidden',
            transition: isRefreshing ? 'none' : 'height 0.3s ease',
        }}>
            <div
                className={isRefreshing ? 'animate-spin' : ''}
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: isTriggered || isRefreshing ? 'var(--primary)' : 'var(--border-color)',
                    borderTopColor: 'transparent',
                    transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                    transition: 'border-color 0.2s ease',
                    opacity: Math.max(progress, 0.3),
                }}
            />
        </div>
    );
}
