import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { getHistory, type HistoryItem } from '../api/predict';
import ClaimPrizeModal from '../components/ClaimPrizeModal';
import ConvertNairaPopup from '../components/ConvertNairaPopup';

const PURPLE_GRAD = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

// ordinal turns 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", etc.
function ordinal(n: number): string {
    const v = n % 100;
    const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    return `${n}${suffix}`;
}

function Flag({ url, name }: { url: string; name: string }) {
    const [broken, setBroken] = useState(false);
    if (url && !broken) {
        return <img src={url} alt={name} onError={() => setBroken(true)} style={{ width: 24, height: 17, objectFit: 'cover', borderRadius: 3 }} />;
    }
    return (
        <span style={{ width: 24, height: 17, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, background: 'var(--progress-bg)', color: 'var(--text-secondary)' }}>
            {name.slice(0, 3).toUpperCase()}
        </span>
    );
}

function actualScore(it: HistoryItem): string {
    if (it.finalHome == null || it.finalAway == null) return '—';
    let s = `${it.finalHome} - ${it.finalAway}`;
    if ((it.homePens ?? 0) || (it.awayPens ?? 0)) {
        s += ` (pens ${it.homePens}-${it.awayPens})`; // display only; not used for Won/Lost
    }
    return s;
}

function formatKickoff(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PredictHistory() {
    const navigate = useNavigate();
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [savedWallet, setSavedWallet] = useState('');
    const [savedHandle, setSavedHandle] = useState('');
    const [poolFallback, setPoolFallback] = useState(0);
    const [loading, setLoading] = useState(true);
    const [claimId, setClaimId] = useState<number | null>(null); // fixture whose modal is open
    const [showConvert, setShowConvert] = useState(false); // "Convert to Naira" popup, shown after a claim

    const load = useCallback(async () => {
        try {
            const res = await getHistory();
            setItems(res.predictions);
            setSavedWallet(res.suiWallet);
            setSavedHandle(res.xHandle);
            setPoolFallback(res.prizePoolUsd);
        } catch {
            /* keep existing */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Always open the Claim modal — it shows the share and prefills/collects payout
    // details.
    const onClaim = useCallback((fixtureId: number) => { setClaimId(fixtureId); }, []);
    const claimItem = items.find((it) => it.fixtureId === claimId);

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, paddingBottom: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                    onClick={() => navigate('/predict')}
                    style={{
                        background: 'var(--surface)', border: 'none', borderRadius: '50%', width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        boxShadow: 'var(--card-shadow)', flexShrink: 0,
                    }}
                >
                    <ArrowLeft size={18} color="var(--text-main)" />
                </button>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>Prediction History</h1>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[110, 110, 110].map((h, i) => (
                        <div key={i} style={{ height: h, borderRadius: 16, background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : !items.length ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    You haven't made any predictions yet.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((it) => {
                        const settled = !!it.result;
                        const won = it.result === 'won';
                        return (
                            <div key={it.fixtureId} className="glass-card" style={{ borderRadius: 16, padding: 14 }}>
                                {/* Teams + date */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                                        <Flag url={it.homeFlag} name={it.homeTeam} />
                                        <span>{it.homeTeam}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>vs</span>
                                        <span>{it.awayTeam}</span>
                                        <Flag url={it.awayFlag} name={it.awayTeam} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    {formatKickoff(it.kickoff)}
                                </div>

                                {/* Prediction vs actual */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 20 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Your prediction</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{it.predHome} - {it.predAway}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Actual (FT)</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{actualScore(it)}</div>
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 12, color: '#fff',
                                            background: !settled ? 'var(--text-secondary)' : won ? '#16a34a' : '#ef4444',
                                        }}
                                    >
                                        {!settled ? 'PENDING' : won ? 'WON' : 'LOST'}
                                    </span>
                                </div>

                                {/* Position among callers of this exact scoreline */}
                                {it.position > 0 && (
                                    <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        You were {ordinal(it.position)} to call {it.predHome}-{it.predAway}
                                    </div>
                                )}

                                {/* Claim action for a won prize (only when eligible) */}
                                {won && it.prizeEligible && (
                                    it.claimed ? (
                                        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 12, padding: '10px 12px' }}>
                                            Prize claimed ✓{it.prizeShareUsd != null ? ` — $${it.prizeShareUsd}` : ''}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onClaim(it.fixtureId)}
                                            style={{ width: '100%', marginTop: 12, padding: 13, borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 800, color: '#fff', background: PURPLE_GRAD, cursor: 'pointer' }}
                                        >
                                            Claim Prize{it.prizeShareUsd != null ? ` — $${it.prizeShareUsd}` : ''}
                                        </button>
                                    )
                                )}

                                {/* Correct scoreline but missed the pool — encourage, no claim */}
                                {won && !it.prizeEligible && (
                                    <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 12, padding: '10px 12px', lineHeight: 1.35 }}>
                                        You nailed {it.predHome}-{it.predAway} — others just beat you to it. Next one's yours.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {claimId != null && (
                <ClaimPrizeModal
                    fixtureId={claimId}
                    prizeShareUsd={claimItem?.prizeShareUsd ?? 0}
                    prizePoolUsd={claimItem?.prizePoolUsd ?? poolFallback}
                    savedWallet={savedWallet}
                    savedHandle={savedHandle}
                    onClose={() => setClaimId(null)}
                    onClaimed={async () => { setClaimId(null); await load(); setShowConvert(true); }}
                />
            )}

            {showConvert && (
                <ConvertNairaPopup
                    onClose={() => setShowConvert(false)}
                    onCtaClick={() => { setShowConvert(false); navigate('/send/details'); }}
                />
            )}
        </div>
    );
}
