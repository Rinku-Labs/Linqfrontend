import React from 'react';

interface SkeletonProps {
    width?: string;
    height?: string;
    borderRadius?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '8px', style }: SkeletonProps) {
    return (
        <div
            className="skeleton-shimmer"
            style={{
                width,
                height,
                borderRadius,
                background: 'var(--skeleton-bg, var(--progress-bg))',
                ...style
            }}
        />
    );
}

/** Skeleton for the balance card on the Home page */
export function BalanceCardSkeleton() {
    return (
        <div style={{
            background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))',
            borderRadius: '24px',
            padding: '32px 24px',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Skeleton width="120px" height="14px" borderRadius="7px" style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <Skeleton width="180px" height="42px" borderRadius="12px" style={{ margin: '0 auto 8px', opacity: 0.25 }} />
                <Skeleton width="100px" height="16px" borderRadius="8px" style={{ margin: '0 auto', opacity: 0.2 }} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
                <Skeleton height="48px" borderRadius="12px" style={{ flex: 1, opacity: 0.2 }} />
                <Skeleton height="48px" borderRadius="12px" style={{ flex: 1, opacity: 0.2 }} />
            </div>
        </div>
    );
}

/** Skeleton for a single transaction row */
export function TransactionRowSkeleton() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
            <Skeleton width="40px" height="40px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
                <Skeleton width="60%" height="14px" borderRadius="7px" style={{ marginBottom: '6px' }} />
                <Skeleton width="40%" height="10px" borderRadius="5px" />
            </div>
            <div style={{ textAlign: 'right' }}>
                <Skeleton width="60px" height="14px" borderRadius="7px" style={{ marginBottom: '6px', marginLeft: 'auto' }} />
                <Skeleton width="40px" height="10px" borderRadius="5px" style={{ marginLeft: 'auto' }} />
            </div>
        </div>
    );
}

/** Skeleton for the transaction list section on the Home page */
export function TransactionListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="glass-card" style={{ borderRadius: '24px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Skeleton width="160px" height="16px" borderRadius="8px" />
                <Skeleton width="60px" height="12px" borderRadius="6px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Array.from({ length: count }).map((_, i) => (
                    <TransactionRowSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}

/** Skeleton for quick action buttons grid */
export function QuickActionsSkeleton() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{
                    background: 'var(--surface)', borderRadius: '20px', padding: '16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    boxShadow: 'var(--card-shadow)'
                }}>
                    <Skeleton width="24px" height="24px" borderRadius="6px" />
                    <Skeleton width="40px" height="12px" borderRadius="6px" />
                </div>
            ))}
        </div>
    );
}

/** Skeleton for the volume tracker card */
export function VolumeTrackerSkeleton() {
    return (
        <div className="glass-card" style={{ borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Skeleton width="140px" height="12px" borderRadius="6px" />
                <Skeleton width="80px" height="12px" borderRadius="6px" />
            </div>
            <Skeleton width="100px" height="24px" borderRadius="8px" style={{ marginBottom: '12px' }} />
            <Skeleton width="100%" height="6px" borderRadius="3px" />
        </div>
    );
}

/** Skeleton for analysis stat cards */
export function AnalysisStatSkeleton() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass-card" style={{
                    borderRadius: '24px', padding: '24px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', aspectRatio: '1/0.8'
                }}>
                    <Skeleton width="80px" height="12px" borderRadius="6px" style={{ marginBottom: '12px' }} />
                    <Skeleton width="60px" height="24px" borderRadius="8px" />
                </div>
            ))}
        </div>
    );
}
