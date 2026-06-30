import { ArrowLeft, ChevronUp, ChevronDown, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    getFixtures,
    getHistory,
    submitPrediction,
    type Fixture,
    type HistoryItem,
} from '../api/predict';
import { usePredictScores } from '../hooks/usePredictScores';

const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const FINISHED = new Set(['F', 'FET', 'FPE']);
const STOPPED: Record<string, string> = { A: 'ABANDONED', C: 'CANCELLED', P: 'POSTPONED', I: 'INTERRUPTED' };

// TxLINE StartTime is unix ms; guard against other magnitudes just in case.
function toMs(t: number): number {
    t = Number(t) || 0;
    if (t > 1e14) return Math.floor(t / 1000);
    if (t > 1e11) return t;
    return t * 1000;
}
const dayKey = (t: number) => new Date(toMs(t)).toISOString().slice(0, 10);
const koTime = (t: number) =>
    new Date(toMs(t)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function labelForDay(d: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    if (d === today) return 'Today';
    if (d === yest) return 'Yesterday';
    if (d === tomorrow) return 'Tomorrow';
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Flag({ url, name, size = 40 }: { url: string; name: string; size?: number }) {
    const [broken, setBroken] = useState(false);
    if (url && !broken) {
        return (
            <img
                src={url}
                alt={name}
                onError={() => setBroken(true)}
                style={{ width: size, height: size * 0.7, objectFit: 'cover', borderRadius: 6 }}
            />
        );
    }
    return (
        <span
            style={{
                width: size, height: size * 0.7, borderRadius: 6, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                background: 'var(--progress-bg)', color: 'var(--text-secondary)',
            }}
        >
            {name.slice(0, 3).toUpperCase()}
        </span>
    );
}

export default function Predict() {
    const navigate = useNavigate();
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [activeDay, setActiveDay] = useState<string | null>(null);
    const [myPreds, setMyPreds] = useState<Record<number, HistoryItem>>({});
    const [loading, setLoading] = useState(true);
    const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
    const fixturesRef = useRef<Fixture[]>([]);

    const scores = usePredictScores();

    const loadHistory = useCallback(async () => {
        try {
            const items = await getHistory();
            const map: Record<number, HistoryItem> = {};
            items.forEach((it) => { map[it.fixtureId] = it; });
            setMyPreds(map);
        } catch {
            /* keep existing */
        }
    }, []);

    const loadFixtures = useCallback(async () => {
        try {
            const list = await getFixtures();
            // Never wipe a good list because of a transient empty/failed fetch.
            if (!list.length && fixturesRef.current.length) return;
            fixturesRef.current = list;
            setFixtures(list);
            setActiveDay((cur) => {
                if (cur !== null || !list.length) return cur;
                const today = new Date().toISOString().slice(0, 10);
                const days = list.map((f) => dayKey(f.startTime));
                return days.includes(today) ? today : [...days].sort()[0];
            });
        } catch {
            /* keep existing fixtures */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFixtures();
        loadHistory();
        const refresh = setInterval(loadFixtures, 10 * 60 * 1000); // periodic schedule refresh
        return () => clearInterval(refresh);
    }, [loadFixtures, loadHistory]);

    const days = [...new Set(fixtures.map((f) => dayKey(f.startTime)))].sort();
    const dayFixtures = fixtures.filter((f) => dayKey(f.startTime) === activeDay);

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'var(--surface)', border: 'none', borderRadius: '50%', width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        boxShadow: 'var(--card-shadow)', flexShrink: 0,
                    }}
                >
                    <ArrowLeft size={18} color="var(--text-main)" />
                </button>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>Predict &amp; Win</h1>
                <button
                    onClick={() => navigate('/predict/history')}
                    style={{
                        background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13,
                        fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    History
                </button>
            </div>

            {/* Hero */}
            <div
                style={{
                    borderRadius: 20, padding: '20px', marginBottom: 20,
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: '#fff',
                }}
            >
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, margin: 0 }}>PREDICT AND WIN</h2>
                <p style={{ fontSize: 12, opacity: 0.9, margin: '6px 0 0' }}>
                    Call the exact full-time score before kickoff. Predictions lock at kickoff.
                </p>
            </div>

            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
                {days.map((d) => {
                    const active = d === activeDay;
                    return (
                        <button
                            key={d}
                            onClick={() => setActiveDay(d)}
                            style={{
                                flexShrink: 0, padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                fontSize: 13, fontWeight: 600,
                                background: active ? 'var(--primary)' : 'var(--surface)',
                                color: active ? '#fff' : 'var(--text-secondary)',
                                boxShadow: active ? 'none' : 'var(--card-shadow)',
                            }}
                        >
                            {labelForDay(d)}
                        </button>
                    );
                })}
            </div>

            {/* Cards */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[160, 160, 160].map((h, i) => (
                        <div key={i} style={{ height: h, borderRadius: 20, background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : !dayFixtures.length ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    No matches on this day.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {dayFixtures.map((f) => (
                        <MatchCard
                            key={f.fixtureId}
                            fixture={f}
                            score={scores[f.fixtureId]}
                            prediction={myPreds[f.fixtureId]}
                            onPredict={() => setModalFixture(f)}
                        />
                    ))}
                </div>
            )}

            {modalFixture && (
                <PredictModal
                    fixture={modalFixture}
                    existing={myPreds[modalFixture.fixtureId]}
                    onClose={() => setModalFixture(null)}
                    onSubmitted={async () => {
                        setModalFixture(null);
                        await loadHistory();
                    }}
                />
            )}
        </div>
    );
}

function statusInfo(score?: { status: string; minute: number }) {
    if (!score) return { live: false, finished: false, stopped: '' };
    return {
        live: LIVE.has(score.status),
        finished: FINISHED.has(score.status),
        stopped: STOPPED[score.status] || '',
    };
}

function MatchCard({
    fixture,
    score,
    prediction,
    onPredict,
}: {
    fixture: Fixture;
    score?: ReturnType<typeof usePredictScores>[number];
    prediction?: HistoryItem;
    onPredict: () => void;
}) {
    const { live, finished, stopped } = statusInfo(score);
    const now = Date.now();
    const kickedOff = !!score || now >= toMs(fixture.startTime);
    const locked = kickedOff; // server is the source of truth; this is just UI state

    let statusPill: React.ReactNode = (
        <span style={pill('var(--surface)', 'var(--text-secondary)')}>{koTime(fixture.startTime)}</span>
    );
    if (live) {
        statusPill = (
            <span style={pill('#ef4444', '#fff')}>
                ● {score!.status === 'PE' ? 'PENALTIES' : `LIVE ${score!.minute || ''}'`}
            </span>
        );
    } else if (finished) {
        statusPill = <span style={pill('var(--text-secondary)', '#fff')}>FULL-TIME</span>;
    } else if (stopped) {
        statusPill = <span style={pill('var(--surface)', 'var(--text-secondary)')}>{stopped}</span>;
    }

    const showScore = !!score && (live || finished);
    const pens = score && (score.homePens || score.awayPens)
        ? `Penalties: ${score.homePens}-${score.awayPens}`
        : '';

    return (
        <div className="glass-card animate-slideUp" style={{ borderRadius: 20, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                    {(fixture.competition || '').replace(/world cup\s*>?/i, '').trim() || 'World Cup'}
                </span>
                {statusPill}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Flag url={fixture.homeFlag} name={fixture.homeTeam} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>{fixture.homeTeam}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
                    {showScore ? (
                        <>
                            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>
                                {score!.homeGoals} - {score!.awayGoals}
                            </span>
                            {pens && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{pens}</span>}
                            {live && score!.status !== 'PE' && (
                                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{score!.minute || 0}'</span>
                            )}
                        </>
                    ) : (
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>VS</span>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Flag url={fixture.awayFlag} name={fixture.awayTeam} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>{fixture.awayTeam}</span>
                </div>
            </div>

            <div style={{ marginTop: 14 }}>
                {prediction ? (
                    <div
                        style={{
                            background: 'var(--progress-bg)', borderRadius: 12, padding: '10px 14px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Your prediction: <b style={{ color: 'var(--text-main)' }}>{prediction.predHome} - {prediction.predAway}</b>
                        </span>
                        {prediction.result ? (
                            <span
                                style={{
                                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                                    color: '#fff', background: prediction.result === 'won' ? '#16a34a' : '#ef4444',
                                }}
                            >
                                {prediction.result === 'won' ? 'WON' : 'LOST'}
                            </span>
                        ) : locked ? (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> Locked
                            </span>
                        ) : (
                            <button onClick={onPredict} style={changeBtn()}>Change</button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={onPredict}
                        disabled={locked}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
                            cursor: locked ? 'default' : 'pointer', color: '#fff',
                            background: locked ? 'var(--text-secondary)' : 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                            opacity: locked ? 0.6 : 1,
                        }}
                    >
                        {locked ? 'Predictions closed' : 'Predict score'}
                    </button>
                )}
            </div>
        </div>
    );
}

function PredictModal({
    fixture,
    existing,
    onClose,
    onSubmitted,
}: {
    fixture: Fixture;
    existing?: HistoryItem;
    onClose: () => void;
    onSubmitted: () => void;
}) {
    const [home, setHome] = useState(existing?.predHome ?? 0);
    const [away, setAway] = useState(existing?.predAway ?? 0);
    const [submitting, setSubmitting] = useState(false);

    const clamp = (n: number) => Math.max(0, Math.min(30, n));

    async function submit() {
        setSubmitting(true);
        try {
            await submitPrediction(fixture.fixtureId, home, away);
            toast.success(`Prediction submitted: ${fixture.homeTeam} ${home} - ${away} ${fixture.awayTeam}`);
            onSubmitted();
        } catch (e: unknown) {
            const msg =
                (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Could not submit prediction.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
            }}
        >
            <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <X size={20} color="var(--text-secondary)" />
                </button>
                <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: 'var(--text-main)', margin: '0 0 20px' }}>
                    PREDICT THE SCORE
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Stepper label={fixture.homeTeam} flag={fixture.homeFlag} value={home} onChange={(d) => setHome(clamp(home + d))} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-secondary)' }}>:</span>
                    <Stepper label={fixture.awayTeam} flag={fixture.awayFlag} value={away} onChange={(d) => setAway(clamp(away + d))} />
                </div>

                <button
                    onClick={submit}
                    disabled={submitting}
                    style={{
                        width: '100%', marginTop: 24, padding: 14, borderRadius: 14, border: 'none', color: '#fff',
                        fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', opacity: submitting ? 0.7 : 1,
                    }}
                >
                    {submitting ? 'Submitting…' : 'Submit Prediction'}
                </button>
            </div>
        </div>
    );
}

function Stepper({ label, flag, value, onChange }: { label: string; flag: string; value: number; onChange: (d: number) => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
            <Flag url={flag} name={label} size={36} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>{label}</span>
            <div
                style={{
                    border: '2px solid var(--primary)', borderRadius: 16, padding: '8px 0', width: 90,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
            >
                <button onClick={() => onChange(1)} style={stepBtn()}><ChevronUp size={20} color="var(--primary)" /></button>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)' }}>{value}</span>
                <button onClick={() => onChange(-1)} style={stepBtn()}><ChevronDown size={20} color="var(--primary)" /></button>
            </div>
        </div>
    );
}

const pill = (bg: string, color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: bg, color,
});
const changeBtn = (): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
    color: 'var(--primary)', background: 'var(--surface)',
});
const stepBtn = (): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
});
