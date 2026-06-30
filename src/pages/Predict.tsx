import { ArrowLeft, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    getFixtures,
    getHistory,
    submitPrediction,
    type Fixture,
    type HistoryItem,
    type LiveScore,
} from '../api/predict';
import { usePredictScores } from '../hooks/usePredictScores';

const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const FINISHED = new Set(['F', 'FET', 'FPE']);
const STOPPED: Record<string, string> = { A: 'ABANDONED', C: 'CANCELLED', P: 'POSTPONED', I: 'INTERRUPTED' };

// Premium dark match-card background (approximates the mockup's stadium glow).
const DARK_CARD = `
  radial-gradient(circle at 22% 28%, rgba(214,164,52,0.28), transparent 42%),
  radial-gradient(circle at 82% 72%, rgba(46,156,178,0.22), transparent 46%),
  radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 60%),
  linear-gradient(150deg, #15101f 0%, #0a0911 100%)`;

const PURPLE = '#7c3aed';
const PURPLE_GRAD = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

// TxLINE StartTime is unix ms; guard against other magnitudes just in case.
function toMs(t: number): number {
    t = Number(t) || 0;
    if (t > 1e14) return Math.floor(t / 1000);
    if (t > 1e11) return t;
    return t * 1000;
}
const dayKey = (t: number) => new Date(toMs(t)).toISOString().slice(0, 10);
const koTime = (t: number) =>
    new Date(toMs(t)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }).toUpperCase();
const abbr = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

function labelForDay(d: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    if (d === today) return 'Today';
    if (d === yest) return 'Yesterday';
    if (d === tomorrow) return 'Tomorrow';
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}

// stageBadge derives the round label (e.g. "RO16") shown on the card. TxLINE puts
// the stage after ">" in Competition when present; otherwise show "WC".
function stageBadge(competition: string): string {
    const parts = (competition || '').split('>');
    const tail = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    if (!tail) return 'WORLD CUP';
    return tail.toUpperCase();
}

function CircleFlag({ url, name, size = 58 }: { url: string; name: string; size?: number }) {
    const [broken, setBroken] = useState(false);
    const common: React.CSSProperties = {
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    };
    if (url && !broken) {
        return <img src={url} alt={name} onError={() => setBroken(true)} style={common} />;
    }
    return (
        <span style={{ ...common, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2a2438', color: '#fff', fontSize: 13, fontWeight: 800 }}>
            {abbr(name)}
        </span>
    );
}

// Countdown renders a ticking "HH:MM:SS to kickoff" that re-renders only itself.
function Countdown({ target }: { target: number }) {
    const [, force] = useState(0);
    useEffect(() => {
        const t = setInterval(() => force((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const diff = target - Date.now();
    if (diff <= 0) return <span>kicking off…</span>;
    const s = Math.floor(diff / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return <span>{hh}:{mm}:{ss} to kickoff</span>;
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
            if (!list.length && fixturesRef.current.length) return; // never wipe a good list
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
        const refresh = setInterval(loadFixtures, 10 * 60 * 1000);
        return () => clearInterval(refresh);
    }, [loadFixtures, loadHistory]);

    const days = [...new Set(fixtures.map((f) => dayKey(f.startTime)))].sort();
    const dayFixtures = fixtures.filter((f) => dayKey(f.startTime) === activeDay);

    return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, paddingBottom: 100 }}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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
                <div style={{ flex: 1 }} />
                <button
                    onClick={() => navigate('/predict/history')}
                    style={{ background: 'none', border: 'none', color: PURPLE, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                    History
                </button>
            </div>

            {/* Hero */}
            <div
                style={{
                    position: 'relative', overflow: 'hidden', borderRadius: 22, marginBottom: 18,
                    minHeight: 130, padding: '24px 22px', color: '#fff',
                    background: 'linear-gradient(135deg, #2b1055 0%, #6d28d9 52%, #b3122e 100%)',
                }}
            >
                {/* rainbow stripe overlay (evokes the mockup hero) */}
                <div aria-hidden style={{
                    position: 'absolute', inset: 0, opacity: 0.16,
                    background: 'repeating-linear-gradient(102deg, #ef4444 0 16px, #f59e0b 16px 32px, #eab308 32px 48px, #22c55e 48px 64px, #06b6d4 64px 80px, #6366f1 80px 96px, #a855f7 96px 112px)',
                }} />
                <div aria-hidden style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 86, lineHeight: 1, opacity: 0.9, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }}>
                    🏆
                </div>
                <div style={{ position: 'relative', zIndex: 1, maxWidth: '72%' }}>
                    <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.0, letterSpacing: 0.5, margin: 0, fontStyle: 'italic' }}>
                        PREDICT<br />AND WIN
                    </h1>
                    <p style={{ fontSize: 12, opacity: 0.92, margin: '10px 0 0', lineHeight: 1.4 }}>
                        Call the exact full-time score before kickoff. Predictions lock at kickoff.
                    </p>
                </div>
            </div>

            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
                {days.map((d) => {
                    const active = d === activeDay;
                    return (
                        <button
                            key={d}
                            onClick={() => setActiveDay(d)}
                            style={{
                                flexShrink: 0, padding: '9px 18px', borderRadius: 22, border: 'none', cursor: 'pointer',
                                fontSize: 13, fontWeight: 700,
                                background: active ? PURPLE_GRAD : 'var(--surface)',
                                color: active ? '#fff' : 'var(--text-secondary)',
                                boxShadow: active ? '0 4px 12px rgba(124,58,237,0.35)' : 'var(--card-shadow)',
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
                    {[200, 200, 200].map((h, i) => (
                        <div key={i} style={{ height: h, borderRadius: 22, background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : !dayFixtures.length ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    No matches on this day.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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

function MatchCard({
    fixture,
    score,
    prediction,
    onPredict,
}: {
    fixture: Fixture;
    score?: LiveScore;
    prediction?: HistoryItem;
    onPredict: () => void;
}) {
    const live = !!score && LIVE.has(score.status);
    const finished = !!score && FINISHED.has(score.status);
    const stopped = score ? STOPPED[score.status] : '';
    const kickedOff = !!score || Date.now() >= toMs(fixture.startTime);
    const showScore = !!score && (live || finished);
    const pens = score && (score.homePens || score.awayPens) ? `Penalties: ${score.homePens}-${score.awayPens}` : '';

    // Status badge shown top-right on the dark card.
    let badge: React.ReactNode = null;
    if (live) {
        badge = <span style={darkPill('#ef4444', '#fff')}>● {score!.status === 'PE' ? 'PENALTIES' : `LIVE ${score!.minute || ''}'`}</span>;
    } else if (finished) {
        badge = <span style={darkPill('rgba(255,255,255,0.18)', '#fff')}>FULL-TIME</span>;
    } else if (stopped) {
        badge = <span style={darkPill('rgba(255,255,255,0.18)', '#fff')}>{stopped}</span>;
    }

    return (
        <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            {/* Dark match panel */}
            <div style={{ background: DARK_CARD, padding: '16px 18px 14px', position: 'relative' }}>
                {/* stage badge + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ ...darkPill(PURPLE, '#fff'), fontSize: 11 }}>{stageBadge(fixture.competition)}</span>
                    {badge}
                </div>

                {/* teams */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                        <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} />
                        <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 78 }}>
                        {showScore ? (
                            <>
                                <span style={{ fontSize: 30, fontWeight: 900, color: '#fff' }}>{score!.homeGoals} - {score!.awayGoals}</span>
                                {pens && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{pens}</span>}
                            </>
                        ) : (
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>VS</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                        <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} />
                        <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                    </div>
                </div>

                {/* time / countdown row (upcoming only) */}
                {!showScore && !stopped && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                        <span style={{ fontWeight: 700 }}>{koTime(fixture.startTime)} WAT</span>
                        <span><Countdown target={toMs(fixture.startTime)} /></span>
                    </div>
                )}
            </div>

            {/* White action footer */}
            <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
                {prediction ? (
                    prediction.result ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                You predicted <b style={{ color: 'var(--text-main)' }}>{abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}</b>
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 12, color: '#fff', background: prediction.result === 'won' ? '#16a34a' : '#ef4444' }}>
                                {prediction.result === 'won' ? 'WON' : 'LOST'}
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(124,58,237,0.10)', color: PURPLE, borderRadius: 12, padding: '8px 12px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                                ⓘ Your prediction is {abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}
                            </div>
                            {kickedOff ? (
                                <button disabled style={btn(true)}>Prediction locked</button>
                            ) : (
                                <button onClick={onPredict} style={btnLight()}>Change prediction</button>
                            )}
                        </>
                    )
                ) : kickedOff ? (
                    <button disabled style={btn(true)}>Predictions closed</button>
                ) : (
                    <button onClick={onPredict} style={btn(false)}>Predict score</button>
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
            toast.success(`Prediction submitted: ${abbr(fixture.homeTeam)} ${home} - ${away} ${abbr(fixture.awayTeam)}`);
            onSubmitted();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not submit prediction.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
        >
            <div style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: 20, width: '100%', maxWidth: 480 }}>
                {/* header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5, color: 'var(--text-main)' }}>PREDICT THE SCORE</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="var(--text-secondary)" />
                    </button>
                </div>

                {/* dark match header */}
                <div style={{ background: DARK_CARD, borderRadius: 18, padding: '16px 16px 18px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        <span style={{ ...darkPill(PURPLE, '#fff'), fontSize: 11 }}>{stageBadge(fixture.competition)}</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
                        {koTime(fixture.startTime)} WAT • <Countdown target={toMs(fixture.startTime)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                            <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} size={52} />
                            <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>VS</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                            <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} size={52} />
                            <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* steppers */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                    <Stepper value={home} onChange={(d) => setHome(clamp(home + d))} />
                    <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-secondary)' }}>:</span>
                    <Stepper value={away} onChange={(d) => setAway(clamp(away + d))} />
                </div>

                <button onClick={submit} disabled={submitting} style={{ ...btn(false), marginTop: 22 }}>
                    {submitting ? 'Submitting…' : 'Submit Prediction'}
                </button>
            </div>
        </div>
    );
}

function Stepper({ value, onChange }: { value: number; onChange: (d: number) => void }) {
    return (
        <div style={{ border: `2px solid ${PURPLE}`, borderRadius: 18, padding: '10px 0', width: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => onChange(1)} style={stepBtn()}><ChevronUp size={22} color={PURPLE} /></button>
            <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.1 }}>{value}</span>
            <button onClick={() => onChange(-1)} style={stepBtn()}><ChevronDown size={22} color={PURPLE} /></button>
        </div>
    );
}

const teamName: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.5)' };
const darkPill = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: bg, color, letterSpacing: 0.3 });
const stepBtn = (): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' });
function btn(disabled: boolean): React.CSSProperties {
    return {
        width: '100%', padding: 14, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#9ca3af' : PURPLE_GRAD,
        opacity: disabled ? 0.9 : 1,
    };
}
function btnLight(): React.CSSProperties {
    return { width: '100%', padding: 14, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', color: PURPLE, background: 'rgba(124,58,237,0.12)' };
}
