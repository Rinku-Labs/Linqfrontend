import { ArrowLeft, ChevronUp, ChevronDown, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    getFixtures,
    getHistory,
    submitPrediction,
    claimPrize,
    type Fixture,
    type HistoryItem,
    type LiveScore,
} from '../api/predict';
import { usePredictScores } from '../hooks/usePredictScores';
import heroImg from '../assets/predict-hero.jpg';

const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const FINISHED = new Set(['F', 'FET', 'FPE']);
const STOPPED: Record<string, string> = { A: 'ABANDONED', C: 'CANCELLED', P: 'POSTPONED', I: 'INTERRUPTED' };

const PURPLE = '#7c3aed';
const PURPLE_GRAD = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

// Dark match-panel background: warm gold glow on the home (left) side, cool blue
// glow on the away (right) side, faint concentric radar arcs, over near-black.
const DARK_CARD = `
  repeating-radial-gradient(circle at 50% 46%, transparent 0 22px, rgba(255,255,255,0.03) 22px 23px),
  radial-gradient(circle at 16% 50%, rgba(216,158,46,0.36), transparent 42%),
  radial-gradient(circle at 86% 50%, rgba(38,118,200,0.34), transparent 44%),
  radial-gradient(circle at 50% 130%, rgba(124,58,237,0.20), transparent 52%),
  linear-gradient(180deg, #0b0913 0%, #161024 100%)`;

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

// labelForDay shows Today/Yesterday for those two days, else DD/MM.
function labelForDay(d: string, today: string, yesterday: string): string {
    if (d === today) return 'Today';
    if (d === yesterday) return 'Yesterday';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
}

// stageRound derives the round label for the RO16-style tab. TxLINE doesn't label
// the round, so we use the stage after ">" in Competition if present, else a short
// "WORLD CUP". (A maintained per-fixture round mapping can slot in here later.)
function stageRound(competition: string): string {
    const parts = (competition || '').split('>');
    const tail = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    if (tail) return tail.toUpperCase();
    return 'WORLD CUP';
}

function CircleFlag({ url, name, size = 64 }: { url: string; name: string; size?: number }) {
    const [broken, setBroken] = useState(false);
    const common: React.CSSProperties = {
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
    };
    if (url && !broken) {
        return <img src={url} alt={name} onError={() => setBroken(true)} style={common} />;
    }
    return (
        <span style={{ ...common, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2a2438', color: '#fff', fontSize: 14, fontWeight: 800 }}>
            {abbr(name)}
        </span>
    );
}

// StageTab is the purple RO16-style tab that straddles the dark/white seam.
function StageTab({ round }: { round: string }) {
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 92, padding: '6px 20px 8px', color: '#fff', fontSize: 13, fontWeight: 800,
                letterSpacing: 0.5, background: PURPLE_GRAD,
                borderRadius: '4px 4px 0 0',
                clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)',
                boxShadow: '0 -2px 10px rgba(124,58,237,0.4)',
            }}
        >
            {round}
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
    if (diff <= 0) return null;
    const s = Math.floor(diff / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return (
        <span style={{ whiteSpace: 'nowrap' }}>
            <b style={{ fontWeight: 800 }}>{hh}:{mm}:{ss}</b>{' '}
            <span style={{ fontWeight: 600, opacity: 0.75 }}>to kickoff</span>
        </span>
    );
}

export default function Predict() {
    const navigate = useNavigate();
    const today = localDay(Date.now());
    const yesterday = localDay(Date.now() - 864e5);

    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [activeDay, setActiveDay] = useState<string>(today); // always start on today
    const [myPreds, setMyPreds] = useState<Record<number, HistoryItem>>({});
    const [hasPayoutInfo, setHasPayoutInfo] = useState(false);
    const [prizeUsd, setPrizeUsd] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
    const [claimFixture, setClaimFixture] = useState<Fixture | null>(null);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const fixturesRef = useRef<Fixture[]>([]);

    const scores = usePredictScores();

    const loadHistory = useCallback(async () => {
        try {
            const res = await getHistory();
            const map: Record<number, HistoryItem> = {};
            res.predictions.forEach((it) => { map[it.fixtureId] = it; });
            setMyPreds(map);
            setHasPayoutInfo(res.hasPayoutInfo);
            setPrizeUsd(res.prizeUsd);
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

    // Claim a won match. If we already have the user's payout details, claim
    // directly (no popup); otherwise open the Claim modal to collect them once.
    const onClaim = useCallback(async (f: Fixture) => {
        if (!hasPayoutInfo) { setClaimFixture(f); return; }
        setClaimingId(f.fixtureId);
        try {
            await claimPrize(f.fixtureId);
            toast.success('Prize claimed! 🎉');
            await loadHistory();
        } catch (e: unknown) {
            const err = e as { response?: { status?: number; data?: { error?: string; needPayoutInfo?: boolean } } };
            if (err?.response?.data?.needPayoutInfo) { setClaimFixture(f); return; }
            toast.error(err?.response?.data?.error || 'Could not claim prize.');
        } finally {
            setClaimingId(null);
        }
    }, [hasPayoutInfo, loadHistory]);

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

            {/* Date tabs */}
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
                {days.map((d) => {
                    const active = d === activeDay;
                    return (
                        <button
                            key={d}
                            onClick={() => setActiveDay(d)}
                            style={{
                                flexShrink: 0, padding: '10px 22px', borderRadius: 22, border: 'none', cursor: 'pointer',
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
                    {[220, 220].map((h, i) => (
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
                            claiming={claimingId === f.fixtureId}
                            onPredict={() => setModalFixture(f)}
                            onClaim={() => onClaim(f)}
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

            {claimFixture && (
                <ClaimModal
                    fixture={claimFixture}
                    prizeUsd={prizeUsd}
                    onClose={() => setClaimFixture(null)}
                    onClaimed={async () => {
                        setClaimFixture(null);
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
    claiming,
    onPredict,
    onClaim,
}: {
    fixture: Fixture;
    score?: LiveScore;
    prediction?: HistoryItem;
    claiming: boolean;
    onPredict: () => void;
    onClaim: () => void;
}) {
    const live = !!score && LIVE.has(score.status);
    const finished = !!score && FINISHED.has(score.status);
    const stopped = score ? STOPPED[score.status] : '';
    const kickedOff = !!score || Date.now() >= toMs(fixture.startTime);
    const showScore = !!score && (live || finished);
    const pens = score && (score.homePens || score.awayPens) ? `Penalties: ${score.homePens}-${score.awayPens}` : '';
    const settled = !!prediction?.result;

    // Right side of the footer time row: countdown (upcoming), live minute, or FT.
    let statusRight: React.ReactNode;
    if (live) {
        statusRight = <span style={{ color: '#ef4444', fontWeight: 800 }}>● {score!.status === 'PE' ? 'PENALTIES' : `LIVE ${score!.minute || ''}'`}</span>;
    } else if (finished) {
        statusRight = <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>FULL-TIME</span>;
    } else if (stopped) {
        statusRight = <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{stopped}</span>;
    } else {
        statusRight = <Countdown target={toMs(fixture.startTime)} />;
    }

    return (
        <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 10px 28px rgba(0,0,0,0.20)', background: 'var(--surface)' }}>
            {/* Dark top: flags · VS/score · names */}
            <div style={{ background: DARK_CARD, padding: '22px 18px 26px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} />
                        <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 92, flexShrink: 0 }}>
                        {showScore ? (
                            <>
                                <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>{score!.homeGoals} - {score!.awayGoals}</span>
                                {pens && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>{pens}</span>}
                            </>
                        ) : (
                            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>VS</span>
                        )}
                    </div>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} />
                        <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* White footer with the RO16 tab straddling the seam */}
            <div style={{ background: 'var(--surface)', padding: '0 16px 16px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: -16, marginBottom: 8, position: 'relative', zIndex: 2 }}>
                    <StageTab round={stageRound(fixture.competition)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: -22, fontSize: 12, color: 'var(--text-main)', gap: 8 }}>
                    <span style={{ fontWeight: 800, maxWidth: 90, lineHeight: 1.15 }}>{koTime(fixture.startTime)} WAT</span>
                    <span style={{ textAlign: 'right', fontSize: 12 }}>{statusRight}</span>
                </div>

                <div style={{ marginTop: 14 }}>
                    {settled ? (
                        <ResultFooter
                            prediction={prediction!}
                            fixture={fixture}
                            claiming={claiming}
                            onClaim={onClaim}
                        />
                    ) : prediction ? (
                        <>
                            <PredictionPill fixture={fixture} prediction={prediction} />
                            {kickedOff ? (
                                <button disabled style={btnMuted()}>Predictions closed</button>
                            ) : (
                                <button onClick={onPredict} style={btnLavender()}>Prediction submitted!</button>
                            )}
                        </>
                    ) : kickedOff ? (
                        <button disabled style={btnMuted()}>Predictions closed</button>
                    ) : (
                        <button onClick={onPredict} style={btnPrimary(false)}>Predict score</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function PredictionPill({ fixture, prediction }: { fixture: Fixture; prediction: HistoryItem }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#dbeafe', color: '#2563eb', borderRadius: 14, padding: '10px 12px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            <Info size={16} />
            Your prediction is {abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}
        </div>
    );
}

function ResultFooter({
    prediction,
    fixture,
    claiming,
    onClaim,
}: {
    prediction: HistoryItem;
    fixture: Fixture;
    claiming: boolean;
    onClaim: () => void;
}) {
    const won = prediction.result === 'won';
    const bg = won ? '#dcfce7' : '#fee2e2';
    const badgeBg = won ? '#16a34a' : '#ef4444';
    const textColor = won ? '#15803d' : '#dc2626';
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: bg, borderRadius: 16, padding: '10px 12px' }}>
                <span style={{ background: badgeBg, color: '#fff', fontSize: 12, fontWeight: 800, padding: '6px 16px', borderRadius: 20, flexShrink: 0 }}>
                    {won ? 'WON' : 'LOST'}
                </span>
                <span style={{ color: textColor, fontSize: 13, fontWeight: 700 }}>
                    You predicted {abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}
                </span>
            </div>
            {won && (
                prediction.claimed ? (
                    <button disabled style={{ ...btnMuted(), marginTop: 12, background: '#dcfce7', color: '#15803d', opacity: 1 }}>
                        Prize claimed ✓
                    </button>
                ) : (
                    <button onClick={onClaim} disabled={claiming} style={{ ...btnPrimary(false), marginTop: 12 }}>
                        {claiming ? 'Claiming…' : 'Claim Prize'}
                    </button>
                )
            )}
        </>
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

    return (
        <Sheet onClose={onClose} title="PREDICT THE SCORE">
            {/* Dark match panel with the RO16 tab at the top-center */}
            <div style={{ background: DARK_CARD, borderRadius: 18, padding: '0 16px 20px', marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StageTab round={stageRound(fixture.competition)} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: '12px 0 16px' }}>
                    <b style={{ fontWeight: 800 }}>{koTime(fixture.startTime)} WAT</b>
                    <span style={{ opacity: 0.6 }}> • </span>
                    <Countdown target={toMs(fixture.startTime)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8 }}>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} size={66} />
                        <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>VS</span>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} size={66} />
                        <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* Steppers — tap the chevrons, or drag/scroll up & down to scrub */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <Stepper value={home} onSet={(v) => setHome(clamp(v))} />
                <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text-main)' }}>:</span>
                <Stepper value={away} onSet={(v) => setAway(clamp(v))} />
            </div>

            <button onClick={submit} disabled={submitting} style={{ ...btnPrimary(false), marginTop: 26 }}>
                {submitting ? 'Submitting…' : 'Submit Prediction'}
            </button>
        </Sheet>
    );
}

function ClaimModal({
    fixture,
    prizeUsd,
    onClose,
    onClaimed,
}: {
    fixture: Fixture;
    prizeUsd: number;
    onClose: () => void;
    onClaimed: () => void;
}) {
    const [wallet, setWallet] = useState('');
    const [handle, setHandle] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!wallet.trim() || !handle.trim()) { toast.error('Enter your Sui wallet address and X handle.'); return; }
        setBusy(true);
        try {
            await claimPrize(fixture.fixtureId, wallet.trim(), handle.trim());
            toast.success('Prize claimed! 🎉');
            onClaimed();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not claim prize.';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Sheet onClose={onClose} title="CLAIM PRIZE">
            {/* Prize panel */}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, marginBottom: 22, background: 'linear-gradient(160deg, #7c3aed 0%, #2a1055 100%)', padding: '18px 16px 26px', textAlign: 'center' }}>
                <Confetti />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 1, padding: '5px 18px', borderRadius: 20 }}>YOU WON</div>
                    <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', marginTop: 8, textShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>${prizeUsd}</div>
                </div>
            </div>

            <label style={fieldLabel}>Sui wallet address</label>
            <input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Enter sui wallet address"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={fieldInput}
            />
            <label style={{ ...fieldLabel, marginTop: 16 }}>X handle</label>
            <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Enter X handle"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={fieldInput}
            />

            <button onClick={submit} disabled={busy} style={{ ...btnPrimary(false), marginTop: 24 }}>
                {busy ? 'Claiming…' : 'Claim prize'}
            </button>
        </Sheet>
    );
}

// Sheet is the shared bottom-sheet chrome: backdrop, slide-up white sheet, header.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            className="animate-fadeIn"
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
            <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)', maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5, color: 'var(--text-main)' }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="var(--text-main)" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// Confetti draws a handful of static purple flecks behind the prize amount.
function Confetti() {
    const bits = [
        [12, 20, -20], [30, 60, 15], [55, 15, 40], [72, 48, -30], [85, 25, 10],
        [20, 70, 25], [46, 80, -15], [64, 68, 35], [90, 62, -20], [8, 48, 12],
    ];
    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-hidden>
            {bits.map(([x, y, r], i) => (
                <span key={i} style={{
                    position: 'absolute', left: `${x}%`, top: `${y}%`, width: 8, height: 3, borderRadius: 1,
                    background: i % 2 ? '#c4b5fd' : '#8b5cf6', transform: `rotate(${r}deg)`, opacity: 0.85,
                }} />
            ))}
        </div>
    );
}

// Stepper supports the chevron buttons, the mouse wheel, and a finger/pointer drag
// (drag up to increase, down to decrease) for touch devices.
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
                border: `2px solid ${PURPLE}`, borderRadius: 22, padding: '14px 0', width: 128, height: 150,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', touchAction: 'none', userSelect: 'none', cursor: 'ns-resize',
            }}
        >
            <button onClick={() => onSet(value + 1)} style={stepBtn()} aria-label="increase score"><ChevronUp size={28} color={PURPLE} /></button>
            <span key={value} className="animate-digit" style={{ fontSize: 48, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.0 }}>{value}</span>
            <button onClick={() => onSet(value - 1)} style={stepBtn()} aria-label="decrease score"><ChevronDown size={28} color={PURPLE} /></button>
        </div>
    );
}

const teamCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexBasis: 0, flexGrow: 1, minWidth: 0 };
const teamName: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#fff', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.5)', maxWidth: '100%', wordBreak: 'break-word', lineHeight: 1.2 };
const stepBtn = (): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' });
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 };
const fieldInput: React.CSSProperties = { width: '100%', padding: '15px 16px', borderRadius: 16, border: '1.5px solid var(--border, #d1d5db)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: 15, outline: 'none', boxSizing: 'border-box' };

function btnPrimary(disabled: boolean): React.CSSProperties {
    return {
        width: '100%', padding: 16, borderRadius: 18, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff',
        cursor: disabled ? 'default' : 'pointer', background: disabled ? '#9ca3af' : PURPLE_GRAD, opacity: disabled ? 0.9 : 1,
    };
}
function btnMuted(): React.CSSProperties {
    return { width: '100%', padding: 15, borderRadius: 16, border: 'none', fontSize: 15, fontWeight: 800, color: '#6b7280', background: '#e5e7eb', cursor: 'default' };
}
function btnLavender(): React.CSSProperties {
    return { width: '100%', padding: 15, borderRadius: 16, border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', color: '#fff', background: '#c4b5fd' };
}
