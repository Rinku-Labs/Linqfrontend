import { ArrowLeft, Copy, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Button from '../components/ui/Button';
import { getRewardsData } from '../api/rewards';
import type { RewardsData } from '../api/rewards';
import referEarnImg from '../assets/refer-earn.png';

export default function Rewards() {
    const navigate = useNavigate();
    const [data, setData] = useState<RewardsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getRewardsData()
            .then(setData)
            .finally(() => setIsLoading(false));
    }, []);

    function copyCode() {
        if (!data) return;
        navigator.clipboard.writeText(data.referral.code);
        toast.success('Referral code copied!');
    }

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
                <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Earn Rewards</h1>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[180, 300, 160].map((h, i) => (
                        <div key={i} style={{
                            height: `${h}px`, borderRadius: '24px',
                            background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite',
                        }} />
                    ))}
                </div>
            ) : data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* XP Card */}
                    <div className="animate-slideUp" style={{
                        background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
                        borderRadius: '24px',
                        padding: '24px',
                    }}>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>Total XP</p>
                        <p style={{ fontSize: '36px', fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: '10px' }}>
                            {data.totalXp.toLocaleString()}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TrendingUp size={14} color="rgba(255,255,255,0.8)" />
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                                    #{data.leaderboardRank} in leaderboard
                                </span>
                            </div>
                            <button
                                onClick={() => navigate('/leaderboard')}
                                style={{
                                    background: '#fff', border: 'none', borderRadius: '20px',
                                    padding: '8px 16px', fontSize: '11px', fontWeight: 600,
                                    color: '#7C3AED', cursor: 'pointer',
                                }}
                            >
                                View leaderboard
                            </button>
                        </div>
                    </div>

                    {/* Refer and Earn */}
                    <div className="glass-card animate-slideUp" style={{ borderRadius: '24px', padding: '24px', animationFillMode: 'backwards' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <img
                                src={referEarnImg}
                                alt="Refer and earn"
                                style={{ height: '160px', objectFit: 'contain' }}
                            />
                        </div>

                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                            Refer and Earn
                        </h2>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                            Invite friends to earn XP and level up! You both earn XP once your referral completes a
                            transaction of $5 or more. Start sharing to stack your rewards.
                        </p>

                        {/* Stats row */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                            background: 'var(--progress-bg)', borderRadius: '16px',
                            padding: '16px', gap: '8px', marginBottom: '20px',
                        }}>
                            {[
                                { label: 'Total referrals', value: String(data.referral.totalReferrals) },
                                { label: 'XP earned', value: String(data.referral.xpEarned) },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{value}</p>
                                    <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Referral code */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            border: '1px solid var(--border, rgba(0,0,0,0.08))',
                            borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
                            background: 'var(--progress-bg)',
                        }}>
                            <div>
                                <p style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Your referral code</p>
                                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{data.referral.code}</p>
                            </div>
                            <button
                                onClick={copyCode}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '8px', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center',
                                }}
                            >
                                <Copy size={18} color="var(--text-secondary)" />
                            </button>
                        </div>

                        <Button variant="primary" fullWidth onClick={copyCode} style={{ borderRadius: '14px', height: '52px' }}>
                            Share your code
                        </Button>
                    </div>

                    {/* Trading Volume */}
                    <div className="animate-slideUp" style={{
                        background: '#EDE9FE', borderRadius: '24px', padding: '24px',
                        animationFillMode: 'backwards', animationDelay: '0.1s',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: '#DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <TrendingUp size={20} color="#7C3AED" />
                            </div>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#4C1D95', marginBottom: '2px' }}>Trading volume</p>
                                <p style={{ fontSize: '10px', color: '#6D28D9' }}>More transactions equals more XP</p>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                            background: 'rgba(255,255,255,0.6)', borderRadius: '16px',
                            padding: '16px', gap: '8px',
                        }}>
                            {[
                                { label: 'Total Volume', value: `$${data.volume.totalVolume.toLocaleString()}` },
                                { label: 'XP earned\n(All-time)', value: `${data.volume.xpAllTime.toLocaleString()} XP` },
                                { label: 'XP earned\n(This month)', value: `${data.volume.xpThisMonth.toLocaleString()} XP` },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#4C1D95', marginBottom: '4px' }}>{value}</p>
                                    <p style={{ fontSize: '9px', color: '#6D28D9', whiteSpace: 'pre-line' }}>{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
