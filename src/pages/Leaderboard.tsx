import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getFullLeaderboard } from '../api/rewards';
import type { LeaderboardEntry, FullLeaderboardData } from '../api/rewards';
import medalGold from '../assets/medal-gold.png';
import medalSilver from '../assets/medal-silver.png';
import medalBronze from '../assets/medal-bronze.png';
import podiumImg from '../assets/podium.png';

type Period = 'week' | 'month' | 'all';

const TABS: { label: string; value: Period }[] = [
    { label: 'This week', value: 'week' },
    { label: 'This month', value: 'month' },
    { label: 'All time', value: 'all' },
];

export default function Leaderboard() {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<Period>('week');
    const [fullData, setFullData] = useState<FullLeaderboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getFullLeaderboard()
            .then(setFullData)
            .finally(() => setIsLoading(false));
    }, []);

    const entries = fullData ? fullData[period] : [];

    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);

    // podium display order: 2nd | 1st | 3rd
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const medals = [medalSilver, medalGold, medalBronze];
    const medalSizes = [52, 64, 48];
    const podiumHeights = [80, 110, 60];

    return (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px', paddingBottom: '100px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'var(--surface)', border: 'none', borderRadius: '50%',
                        width: '40px', height: '40px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--card-shadow)',
                        flexShrink: 0,
                    }}
                >
                    <ArrowLeft size={18} color="var(--text-main)" />
                </button>
                <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Leaderboard</h1>
            </div>

            {/* Period tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setPeriod(tab.value)}
                        style={{
                            padding: '10px 18px', borderRadius: '24px', border: 'none',
                            fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            background: period === tab.value ? 'var(--primary)' : '#F3F4F6',
                            color: period === tab.value ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ height: '300px', borderRadius: '24px', background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={{ height: '60px', borderRadius: '16px', background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : (
                <>
                    {/* Podium card */}
                    {top3.length === 3 && (
                        <div className="animate-slideUp" style={{
                            background: '#EDE9FE', borderRadius: '24px',
                            padding: '24px 16px 0 16px', marginBottom: '16px', overflow: 'hidden',
                        }}>
                            {/* Names and medals */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '0' }}>
                                {podiumOrder.map((entry, i) => entry && (
                                    <div key={entry.rank} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        flex: 1, paddingBottom: `${podiumHeights[i]}px`,
                                    }}>
                                        <img
                                            src={medals[i]}
                                            alt={`#${entry.rank} medal`}
                                            style={{ width: `${medalSizes[i]}px`, height: `${medalSizes[i]}px`, objectFit: 'contain', marginBottom: '8px' }}
                                        />
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', marginBottom: '4px', textAlign: 'center' }}>
                                            {entry.username}
                                        </p>
                                        <p style={{ fontSize: '10px', color: '#5B21B6', fontWeight: 600, textAlign: 'center' }}>
                                            {entry.xp.toLocaleString()}XP
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {/* Podium blocks — replace src/assets/podium.png with the Figma export to update */}
                            <img
                                src={podiumImg}
                                alt="Podium"
                                style={{ width: '100%', display: 'block', marginTop: '-8px' }}
                            />
                        </div>
                    )}

                    {/* Ranked list */}
                    <div className="glass-card animate-slideUp" style={{
                        borderRadius: '24px', padding: '8px 20px',
                        animationFillMode: 'backwards', animationDelay: '0.1s',
                    }}>
                        {rest.map((entry, index) => (
                            <div key={`${entry.rank}-${index}`} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 0',
                                borderBottom: index < rest.length - 1 ? '1px solid var(--progress-bg)' : 'none',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: '#F3F4F6', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            {entry.rank > 999 ? '999+' : entry.rank}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {entry.username}
                                    </span>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    {entry.xp.toLocaleString()}XP
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
