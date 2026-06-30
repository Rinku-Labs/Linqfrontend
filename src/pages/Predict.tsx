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
import heroImg from '../assets/predict-hero.jpg';

const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const FINISHED = new Set(['F', 'FET', 'FPE']);
const STOPPED: Record<string, string> = { A: 'ABANDONED', C: 'CANCELLED', P: 'POSTPONED', I: 'INTERRUPTED' };
// Phases where the match clock is running, so we can advance the minute locally.
const ACTIVE_PLAY = new Set(['H1', 'H2', 'ET1', 'ET2']);
// Per-phase ceilings so a missed full-time event can't run the local clock away
// (the backend also force-finalizes a silent match within ~20m).
const MIN_CAP: Record<string, number> = { H1: 48, H2: 95, ET1: 120, ET2: 135 };

// Dark match-card background tuned to the mockup: warm gold glow on the home
// (left) side, cool blue glow on the away (right) side, over a near-black base.
const DARK_CARD = `
  radial-gradient(circle at 16% 52%, rgba(216,158,46,0.34), transparent 40%),
  radial-gradient(circle at 86% 52%, rgba(38,118,200,0.32), transparent 42%),
  radial-gradient(circle at 50% 130%, rgba(124,58,237,0.18), transparent 52%),
  linear-gradient(180deg, #0b0913 0%, #161024 100%)`;

const PURPLE = '#7c3aed';
const PURPLE_GRAD = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

// TxLINE StartTime is unix ms; guard against other magnitudes just in case.
function toMs(t: number): number {
    t = Number(t) || 0;
    if (t > 1e14) return Math.floor(t / 1000);
    if (t > 1e11) return t;
    return t * 1000;
}
// Local-timezone day key (so "today"/"yesterday" match what the user sees).
function localDay(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dayKey = (t: number) => localDay(toMs(t));
const koTime = (t: number) =>
    new Date(toMs(t)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }).toUpperCase();
const abbr = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

// labelForDay shows Today/Yesterday for those two days, else DD/MM (like the
// designer's "27/06" tabs).
function labelForDay(d: string, today: string, yesterday: string): string {
    if (d === today) return 'Today';
    if (d === yesterday) return 'Yesterday';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
}

// stageBadge derives the round label shown on the card. TxLINE puts the stage
// after ">" in Competition when present; otherwise show the competition name.
function stageBadge(competition: string): string {
    const parts = (competition || '').split('>');
    const tail = parts.length > 1 ? parts[parts.length - 1].trim() : (competition || '').trim();
    return (tail || 'World Cup').toUpperCase();
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

// LiveMinute renders the match minute and, during active play, advances it once a
// second from the timestamp of the last server event. The backend only pushes on
// goal/status/penalty changes (to keep fan-out light across many live games and
// browsers), so the raw minute would otherwise sit frozen between goals. Goals,
// status and the kickoff lock all still come from the server — this is a
// display-only clock, so it can't affect predictions, settlement or open any
// cheating window. The next server push resets the base, correcting any drift.
function LiveMinute({ score }: { score: LiveScore }) {
    const [, force] = useState(0);
    const ticking = ACTIVE_PLAY.has(score.status);
    useEffect(() => {
        if (!ticking) return;
        const t = setInterval(() => force((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, [ticking]);
    let m = score.minute || 0;
    if (ticking && score.updatedAt) {
        const elapsed = Math.floor((Date.now() - score.updatedAt) / 60000);
        if (elapsed > 0) m += elapsed;
        const cap = MIN_CAP[score.status];
        if (cap && m > cap) m = cap;
    }
    return <>{m}'</>;
}

export default function Predict() {
    const navigate = useNavigate();
    const today = localDay(Date.now());
    const yesterday = localDay(Date.now() - 864e5);

    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [activeDay, setActiveDay] = useState<string>(today); // always start on today
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

    // Tabs: yesterday + today are always present, plus every day the API actually
    // has World Cup fixtures for, sorted. The page opens on today.
    const days = (() => {
        const set = new Set<string>([yesterday, today]);
        fixtures.forEach((f) => {
            const k = dayKey(f.startTime);
            if (k >= yesterday) set.add(k); // never surface fixture dates older than yesterday
        });
        return [...set].sort();
    })();
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

            {/* Hero — the designer's artwork */}
            <div style={{ borderRadius: 22, overflow: 'hidden', marginBottom: 18, lineHeight: 0, boxShadow: 'var(--card-shadow)' }}>
                <img src={heroImg} alt="Predict and Win" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>

            {/* Date tabs — yesterday + today + available fixture dates */}
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
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
                            {labelForDay(d, today, yesterday)}
                        </button>
                    );
                })}
            </div>

            {/* Cards */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[200, 200].map((h, i) => (
                        <div key={i} style={{ height: h, borderRadius: 22, background: 'var(--progress-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : !dayFixtures.length ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    No World Cup matches on {labelForDay(activeDay, today, yesterday)}.
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

    // Badge mirrors the demo's logic exactly: LIVE/FULL-TIME only come from a real
    // score event, never inferred from the clock — otherwise an ended match with no
    // score in the feed would falsely read "LIVE". With no score we just show the
    // kickoff time.
    let badge: React.ReactNode;
    if (live) {
        badge = <span style={darkPill('#ef4444', '#fff')}>● {score!.status === 'PE' ? 'PENALTIES' : <>LIVE <LiveMinute score={score!} /></>}</span>;
    } else if (finished) {
        badge = <span style={darkPill('rgba(255,255,255,0.18)', '#fff')}>FULL-TIME</span>;
    } else if (stopped) {
        badge = <span style={darkPill('rgba(255,255,255,0.18)', '#fff')}>{stopped}</span>;
    } else {
        badge = <span style={darkPill('rgba(255,255,255,0.18)', '#fff')}>{koTime(fixture.startTime)} WAT</span>;
    }

    return (
        <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <div style={{ background: DARK_CARD, padding: '16px 18px 14px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ ...darkPill(PURPLE, '#fff'), fontSize: 11 }}>{stageBadge(fixture.competition)}</span>
                    {badge}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexBasis: 0, flexGrow: 1, minWidth: 0 }}>
                        <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} />
                        <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 86, flexShrink: 0 }}>
                        {showScore ? (
                            <>
                                <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>{score!.homeGoals} - {score!.awayGoals}</span>
                                {pens && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>{pens}</span>}
                            </>
                        ) : (
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>VS</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexBasis: 0, flexGrow: 1, minWidth: 0 }}>
                        <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} />
                        <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                    </div>
                </div>

            </div>

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
    const [home, setHome] = useState(existing?.predHome ?? 1);
    const [away, setAway] = useState(existing?.predAway ?? 1);
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

    // Bottom-sheet modal matching the designer's "PREDICT THE SCORE" mockup: a
    // white sheet with the dark match panel inside it, then the steppers + submit.
    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            className="animate-fadeIn"
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
            <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: 'var(--text-main)' }}>PREDICT THE SCORE</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="var(--text-main)" />
                    </button>
                </div>

                {/* Dark match panel */}
                <div style={{ background: DARK_CARD, borderRadius: 18, padding: '16px 16px 18px', marginBottom: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        <span style={{ ...darkPill(PURPLE, '#fff'), fontSize: 12, padding: '6px 18px' }}>{stageBadge(fixture.competition)}</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 14 }}>
                        {koTime(fixture.startTime)} WAT • <Countdown target={toMs(fixture.startTime)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} size={60} />
                            <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>VS</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} size={60} />
                            <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* Steppers — tap the chevrons, or drag/scroll up & down to scrub */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
                    <Stepper value={home} onSet={(v) => setHome(clamp(v))} />
                    <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-main)' }}>:</span>
                    <Stepper value={away} onSet={(v) => setAway(clamp(v))} />
                </div>

                <button onClick={submit} disabled={submitting} style={{ ...btn(false), marginTop: 24 }}>
                    {submitting ? 'Submitting…' : 'Submit Prediction'}
                </button>
            </div>
        </div>
    );
}

// Stepper supports three inputs: the chevron buttons, the mouse wheel, and a
// finger/pointer drag (drag up to increase, down to decrease) for touch devices.
function Stepper({ value, onSet }: { value: number; onSet: (v: number) => void }) {
    const drag = useRef<{ y: number; v: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // let the chevrons click
        drag.current = { y: e.clientY, v: value };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        const steps = Math.round((drag.current.y - e.clientY) / 16); // 16px ≈ 1 goal
        onSet(drag.current.v + steps);
    };
    const endDrag = (e: React.PointerEvent) => {
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };

    return (
        <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={(e) => onSet(value + (e.deltaY < 0 ? 1 : -1))}
            style={{
                border: `2px solid ${PURPLE}`, borderRadius: 18, padding: '12px 0', width: 120,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'var(--surface)',
                touchAction: 'none', userSelect: 'none', cursor: 'ns-resize',
            }}
        >
            <button onClick={() => onSet(value + 1)} style={stepBtn()} aria-label="increase score"><ChevronUp size={26} color={PURPLE} /></button>
            <span key={value} className="animate-digit" style={{ fontSize: 46, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.0 }}>{value}</span>
            <button onClick={() => onSet(value - 1)} style={stepBtn()} aria-label="decrease score"><ChevronDown size={26} color={PURPLE} /></button>
        </div>
    );
}

const teamName: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.5)', maxWidth: '100%', wordBreak: 'break-word', lineHeight: 1.2, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const darkPill = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: bg, color, letterSpacing: 0.3 });
const stepBtn = (): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' });
function btn(disabled: boolean): React.CSSProperties {
    return {
        width: '100%', padding: 16, borderRadius: 16, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#9ca3af' : PURPLE_GRAD,
        opacity: disabled ? 0.9 : 1,
    };
}
function btnLight(): React.CSSProperties {
    return { width: '100%', padding: 14, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', color: PURPLE, background: 'rgba(124,58,237,0.12)' };
}
