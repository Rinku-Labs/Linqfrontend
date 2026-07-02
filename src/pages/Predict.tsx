import { ArrowLeft, ChevronUp, ChevronDown, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    getFixtures,
    getHistory,
    submitPrediction,
    acceptTerms,
    type Fixture,
    type HistoryItem,
    type LiveScore,
} from '../api/predict';
import { usePredictScores } from '../hooks/usePredictScores';
import ClaimPrizeModal from '../components/ClaimPrizeModal';
import heroImg from '../assets/predict-hero.jpg';

const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const FINISHED = new Set(['F', 'FET', 'FPE']);
const STOPPED: Record<string, string> = { A: 'ABANDONED', C: 'CANCELLED', P: 'POSTPONED', I: 'INTERRUPTED' };

// Design tokens taken from the Figma spec (Frame 2147261706 et al).
const PURPLE = '#8A4FFF';
const PURPLE_GRAD = '#8A4FFF';
// RO16 tab gradient (Rectangle 32).
const TAB_GRAD = 'linear-gradient(89.83deg, #8A4FFF 0.15%, #532F99 47.09%, #8A4FFF 94.04%)';
// Archivo — a free grotesque standing in for the designer's Belfast Grotesk on
// the display text (RO16, team names, scores, times, stepper numbers).
const HEAD = "'Archivo', system-ui, sans-serif";

// Match-card background: black base, warm/cool team glows, faint concentric radar
// arcs (approximating the designer's blurred-crest + ring layers).
const DARK_CARD = `
  repeating-radial-gradient(ellipse 130% 96% at 50% 42%, transparent 0 20px, rgba(255,255,255,0.055) 20px 21px),
  radial-gradient(circle at 20% 46%, rgba(216,158,46,0.34), transparent 44%),
  radial-gradient(circle at 82% 48%, rgba(38,118,200,0.32), transparent 46%),
  #000000`;

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

// ordinal turns 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", etc.
function ordinal(n: number): string {
    const v = n % 100;
    const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    return `${n}${suffix}`;
}

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

function CircleFlag({ url, name, size = 90 }: { url: string; name: string; size?: number }) {
    const [broken, setBroken] = useState(false);
    const common: React.CSSProperties = {
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
    };
    if (url && !broken) {
        return <img src={url} alt={name} onError={() => setBroken(true)} style={common} />;
    }
    return (
        <span style={{ ...common, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2a2438', color: '#fff', fontSize: 16, fontWeight: 800 }}>
            {abbr(name)}
        </span>
    );
}

// StageTab is the purple RO16 tab (Group 427319478): a downward-tapering trapezoid
// with the horizontal 3-stop gradient, meant to straddle the white panel's top.
function StageTab({ round }: { round: string }) {
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 88, maxWidth: 150, padding: '4px 18px 6px', color: '#fff', whiteSpace: 'nowrap',
                fontFamily: HEAD, fontSize: 13, fontWeight: 800, letterSpacing: '-0.4px',
                background: TAB_GRAD,
                clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
            }}
        >
            {round}
        </span>
    );
}

// Countdown renders the ticking "HH:MM:SS to kickoff" — two lines by default
// (card), single line when inline (modal). Re-renders only itself.
function Countdown({ target, inline }: { target: number; inline?: boolean }) {
    const [, force] = useState(0);
    useEffect(() => {
        const t = setInterval(() => force((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const diff = target - Date.now();
    if (diff <= 0) return <span style={{ fontWeight: 800 }}>kicking off…</span>;
    const s = Math.floor(diff / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    if (inline) {
        return <span style={{ whiteSpace: 'nowrap' }}><b style={{ fontWeight: 800 }}>{hh}:{mm}:{ss}</b> to kickoff</span>;
    }
    return (
        <span style={{ whiteSpace: 'nowrap' }}>
            <b style={{ fontWeight: 800 }}>{hh}:{mm}:{ss}</b>
            <br />
            <span style={{ fontWeight: 600, fontSize: 12 }}>to kickoff</span>
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
    const [savedWallet, setSavedWallet] = useState('');
    const [savedHandle, setSavedHandle] = useState('');
    const [prizePoolUsd, setPrizePoolUsd] = useState(0);
    const [maxWinners, setMaxWinners] = useState(5);
    const [acceptedTerms, setAcceptedTerms] = useState(true); // assume until history says otherwise (avoids a flash)
    const [loading, setLoading] = useState(true);
    const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
    const [claimFixture, setClaimFixture] = useState<Fixture | null>(null);
    const fixturesRef = useRef<Fixture[]>([]);

    const scores = usePredictScores();

    const loadHistory = useCallback(async () => {
        try {
            const res = await getHistory();
            const map: Record<number, HistoryItem> = {};
            res.predictions.forEach((it) => { map[it.fixtureId] = it; });
            setMyPreds(map);
            setSavedWallet(res.suiWallet);
            setSavedHandle(res.xHandle);
            setPrizePoolUsd(res.prizePoolUsd);
            setMaxWinners(res.maxWinners);
            setAcceptedTerms(res.acceptedTerms);
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

    // Claim a won match — always open the Claim modal, which shows the prize share
    // and prefills (or collects) the payout details.
    const onClaim = useCallback((f: Fixture) => { setClaimFixture(f); }, []);

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
        // Break out of MainLayout's 16px page padding so the hero is flush to the
        // top and screen edges (no white gap above it).
        <div style={{ margin: '-16px -16px 0', position: 'relative' }}>
            {/* Hero — full-width artwork with the nav overlaid on top */}
            <div style={{ position: 'relative', lineHeight: 0 }}>
                <img src={heroImg} alt="Predict and Win" style={{ width: '100%', height: 'auto', display: 'block' }} />
                {/* Nav pinned to the top of the hero. Uses a flat offset (not
                    env(safe-area-inset-top)): the hero always renders below the
                    browser chrome — like the rest of the app, which never applies a
                    top safe-area inset — and some browsers report a large spurious
                    inset in a normal tab, which used to shove these buttons down
                    into the title. A flat offset keeps them consistent everywhere. */}
                <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{ background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                    >
                        <ArrowLeft size={18} color="#fff" />
                    </button>
                    <button
                        onClick={() => navigate('/predict/history')}
                        style={{ background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: 18, padding: '8px 14px', color: '#fff', fontFamily: "'Roboto', system-ui, sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                    >
                        History
                    </button>
                </div>
            </div>

            {/* Content card — tabs + fixtures, seated on top of the hero (rounded top overlaps it) */}
            <div style={{ position: 'relative', zIndex: 2, marginTop: -30, background: 'var(--surface)', borderRadius: '30px 30px 0 0', padding: '22px 14px 40px', minHeight: 320 }}>
                {/* Date tabs */}
                <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
                {days.map((d) => {
                    const active = d === activeDay;
                    return (
                        <button
                            key={d}
                            onClick={() => setActiveDay(d)}
                            style={{
                                flexShrink: 0, minWidth: 96, padding: '11px 20px', borderRadius: 22, border: 'none', cursor: 'pointer',
                                fontFamily: "'Roboto', system-ui, sans-serif", fontSize: 13, fontWeight: 500,
                                background: active ? '#8A4FFF' : 'var(--progress-bg)',
                                color: active ? '#FFFFFF' : 'var(--text-secondary)',
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
                            maxWinners={maxWinners}
                            onPredict={() => setModalFixture(f)}
                            onClaim={() => onClaim(f)}
                        />
                    ))}
                </div>
            )}
            </div>

            {modalFixture && (
                <PredictModal
                    fixture={modalFixture}
                    existing={myPreds[modalFixture.fixtureId]}
                    acceptedTerms={acceptedTerms}
                    prizePoolUsd={prizePoolUsd}
                    maxWinners={maxWinners}
                    onAccepted={() => setAcceptedTerms(true)}
                    onClose={() => setModalFixture(null)}
                    onSubmitted={async () => {
                        setModalFixture(null);
                        await loadHistory();
                    }}
                />
            )}

            {claimFixture && (
                <ClaimPrizeModal
                    fixtureId={claimFixture.fixtureId}
                    prizeShareUsd={myPreds[claimFixture.fixtureId]?.prizeShareUsd ?? 0}
                    prizePoolUsd={myPreds[claimFixture.fixtureId]?.prizePoolUsd ?? prizePoolUsd}
                    savedWallet={savedWallet}
                    savedHandle={savedHandle}
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
    maxWinners,
    onPredict,
    onClaim,
}: {
    fixture: Fixture;
    score?: LiveScore;
    prediction?: HistoryItem;
    maxWinners: number;
    onPredict: () => void;
    onClaim: () => void;
}) {
    const live = !!score && LIVE.has(score.status);
    const finished = !!score && FINISHED.has(score.status);
    const stopped = score ? STOPPED[score.status] : '';
    const kickedOff = !!score || Date.now() >= toMs(fixture.startTime);
    const showScore = !!score && (live || finished);
    const pens = score && (score.homePens || score.awayPens) ? `Pens ${score.homePens}-${score.awayPens}` : '';
    const settled = !!prediction?.result;

    // Right side of the panel's time row: countdown (upcoming), live minute, or FT.
    let statusRight: React.ReactNode;
    if (live) {
        statusRight = <span style={{ color: '#ef4444', fontWeight: 800 }}>● {score!.status === 'PE' ? 'PENALTIES' : `LIVE ${score!.minute || ''}'`}</span>;
    } else if (finished) {
        statusRight = <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>FULL-TIME</span>;
    } else if (stopped) {
        statusRight = <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{stopped}</span>;
    } else {
        statusRight = <Countdown target={toMs(fixture.startTime)} inline />;
    }

    return (
        <div style={{ position: 'relative', background: DARK_CARD, borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 26px rgba(0,0,0,0.28)' }}>
            {/* Flags · VS/score · names */}
            <div style={{ position: 'relative', zIndex: 1, padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <div style={teamCol}>
                    <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} size={82} />
                    <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                </div>
                <div style={{ width: 66, flexShrink: 0, textAlign: 'center', marginTop: -16 }}>
                    {showScore ? (
                        <>
                            <div style={{ fontFamily: HEAD, fontSize: 28, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{score!.homeGoals} - {score!.awayGoals}</div>
                            {pens && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>{pens}</div>}
                        </>
                    ) : (
                        <span style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>VS</span>
                    )}
                </div>
                <div style={teamCol}>
                    <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} size={82} />
                    <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                </div>
            </div>

            {/* Inset panel (Frame 2147261720) — themed surface; RO16 tab rests on its top boundary */}
            <div style={{ position: 'relative', zIndex: 1, margin: '12px 6px 6px', background: 'var(--surface)', borderRadius: 18, padding: '0 16px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <StageTab round={stageRound(fixture.competition)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontFamily: HEAD, color: 'var(--text-main)', letterSpacing: '-0.4px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{koTime(fixture.startTime)} WAT</span>
                    <span style={{ textAlign: 'right', fontWeight: 800, fontSize: 13 }}>{statusRight}</span>
                </div>

                <div style={{ marginTop: 14 }}>
                    {settled ? (
                        <ResultFooter prediction={prediction!} fixture={fixture} maxWinners={maxWinners} onClaim={onClaim} />
                    ) : prediction ? (
                        <>
                            <PredictionPill fixture={fixture} prediction={prediction} />
                            <PositionLine prediction={prediction} />
                            {kickedOff ? (
                                <button disabled style={btnMuted()}>Predictions closed</button>
                            ) : (
                                <button onClick={onPredict} style={btnLavender()}>Change prediction</button>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#DDE9FF', color: '#2563eb', borderRadius: 14, padding: '11px 12px', fontFamily: HEAD, fontSize: 13, fontWeight: 700, lineHeight: 1.25, marginBottom: 8, textAlign: 'center' }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>Your prediction is <span style={{ whiteSpace: 'nowrap' }}>{abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}</span></span>
        </div>
    );
}

// PositionLine tells the user where they rank among everyone who called this exact
// scoreline — e.g. "You're 3rd to call 2-1". Rank alone (the pool size is explained
// in the Terms), spelled with the score so the number always has an object.
function PositionLine({ prediction }: { prediction: HistoryItem }) {
    if (!prediction.position || prediction.position < 1) return null;
    return (
        <div style={{ textAlign: 'center', fontFamily: HEAD, fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
            You're {ordinal(prediction.position)} to call {prediction.predHome}-{prediction.predAway}
        </div>
    );
}

function ResultFooter({
    prediction,
    fixture,
    maxWinners,
    onClaim,
}: {
    prediction: HistoryItem;
    fixture: Fixture;
    maxWinners: number;
    onClaim: () => void;
}) {
    const won = prediction.result === 'won';
    // A "won" (correct scoreline) that missed the pool: encourage, don't discourage,
    // and never show a Claim button.
    if (won && !prediction.prizeEligible) {
        return (
            <div style={{ background: '#DCFCE7', borderRadius: 16, padding: '12px 14px', fontFamily: HEAD, color: '#15803D', fontSize: 13, fontWeight: 700, lineHeight: 1.35, textAlign: 'center' }}>
                You nailed <span style={{ whiteSpace: 'nowrap' }}>{prediction.predHome}-{prediction.predAway}</span> — the first {maxWinners} just beat you to it. Next one's yours.
            </div>
        );
    }

    const bg = won ? '#DCFCE7' : '#FEE2E2';
    const badgeBg = won ? '#16A34A' : '#EF4444';
    const textColor = won ? '#15803D' : '#DC2626';
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, borderRadius: 16, padding: '10px 12px', fontFamily: HEAD }}>
                <span style={{ background: badgeBg, color: '#fff', fontSize: 13, fontWeight: 800, padding: '7px 16px', borderRadius: 20, flexShrink: 0 }}>
                    {won ? 'WON' : 'LOST'}
                </span>
                <span style={{ color: textColor, fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                    You predicted <span style={{ whiteSpace: 'nowrap' }}>{abbr(fixture.homeTeam)} {prediction.predHome} - {prediction.predAway} {abbr(fixture.awayTeam)}</span>
                </span>
            </div>
            {won && (
                prediction.claimed ? (
                    <button disabled style={{ ...btnMuted(), marginTop: 12, background: '#DCFCE7', color: '#15803D', opacity: 1 }}>
                        Prize claimed ✓{prediction.prizeShareUsd != null ? ` — $${prediction.prizeShareUsd}` : ''}
                    </button>
                ) : (
                    <button onClick={onClaim} style={{ ...btnPrimary(false), marginTop: 12 }}>
                        Claim Prize{prediction.prizeShareUsd != null ? ` — $${prediction.prizeShareUsd}` : ''}
                    </button>
                )
            )}
        </>
    );
}

function PredictModal({
    fixture,
    existing,
    acceptedTerms,
    prizePoolUsd,
    maxWinners,
    onAccepted,
    onClose,
    onSubmitted,
}: {
    fixture: Fixture;
    existing?: HistoryItem;
    acceptedTerms: boolean;
    prizePoolUsd: number;
    maxWinners: number;
    onAccepted: () => void;
    onClose: () => void;
    onSubmitted: () => void;
}) {
    const [home, setHome] = useState(existing?.predHome ?? 1);
    const [away, setAway] = useState(existing?.predAway ?? 1);
    const [submitting, setSubmitting] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    // Terms are shown once ever, and only on a FIRST prediction ("Predict score"),
    // never on "Change prediction" (existing prediction).
    const needsTerms = !existing && !acceptedTerms;
    const clamp = (n: number) => Math.max(0, Math.min(30, n));

    async function doSubmit() {
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

    // Submit intercepts the first-ever prediction to show the Terms; once accepted
    // (this session or previously) it goes straight through.
    function submit() {
        if (needsTerms) { setShowTerms(true); return; }
        void doSubmit();
    }

    async function agreeTerms() {
        setSubmitting(true);
        try {
            await acceptTerms();
            onAccepted();
            setShowTerms(false);
            await doSubmit();
        } catch {
            setSubmitting(false);
            toast.error('Could not record your acceptance. Please try again.');
        }
    }

    // "I don't agree" returns the user to the predict main page without persisting
    // acceptance — so they're prompted again next time.
    function declineTerms() {
        setShowTerms(false);
        onClose();
    }

    if (showTerms) {
        return <TermsSheet prizePoolUsd={prizePoolUsd} maxWinners={maxWinners} busy={submitting} onAgree={agreeTerms} onDecline={declineTerms} />;
    }

    return (
        <Sheet onClose={onClose} title="PREDICT THE SCORE">
            {/* Black match panel (Frame 2147261719) — RO16 tab sits inside at the top */}
            <div style={{ position: 'relative', marginTop: 8, marginBottom: 28, background: DARK_CARD, borderRadius: 20, padding: '0 16px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <StageTab round={stageRound(fixture.competition)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, fontFamily: HEAD, fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 20, whiteSpace: 'nowrap' }}>
                    <span>{koTime(fixture.startTime)} WAT</span>
                    <span><Countdown target={toMs(fixture.startTime)} inline /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.homeFlag} name={fixture.homeTeam} size={90} />
                        <span style={teamName}>{fixture.homeTeam.toUpperCase()}</span>
                    </div>
                    <span style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 700, letterSpacing: '-1px', color: '#fff' }}>VS</span>
                    <div style={teamCol}>
                        <CircleFlag url={fixture.awayFlag} name={fixture.awayTeam} size={90} />
                        <span style={teamName}>{fixture.awayTeam.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* Steppers — tap the chevrons, or drag/scroll up & down to scrub */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 32 }}>
                <Stepper value={home} onSet={(v) => setHome(clamp(v))} />
                <span style={{ fontFamily: HEAD, fontSize: 48, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-main)' }}>:</span>
                <Stepper value={away} onSet={(v) => setAway(clamp(v))} />
            </div>

            <button onClick={submit} disabled={submitting} style={btnPrimary(false)}>
                {submitting ? 'Submitting…' : 'Submit Prediction'}
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
                    <span style={{ fontFamily: HEAD, fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="var(--text-main)" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// TermsSheet is the non-dismissible Terms & Conditions gate shown once, on a user's
// first prediction. It uses the same bottom-sheet chrome as the rest of the game
// (no foreign styling) but deliberately has NO close affordance — the only way out
// is "I don't agree", which returns them to the predict page without accepting.
function TermsSheet({
    prizePoolUsd,
    maxWinners,
    busy,
    onAgree,
    onDecline,
}: {
    prizePoolUsd: number;
    maxWinners: number;
    busy: boolean;
    onAgree: () => void;
    onDecline: () => void;
}) {
    const bullet: React.CSSProperties = { fontFamily: HEAD, fontSize: 13.5, fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.5, marginBottom: 12, display: 'flex', gap: 10 };
    const dot = <span style={{ color: PURPLE, fontWeight: 900, flexShrink: 0 }}>•</span>;
    return (
        <div
            className="animate-fadeIn"
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
            <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)', maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: HEAD, fontSize: 17, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: 6 }}>TERMS &amp; CONDITIONS</div>
                <div style={{ fontFamily: ROBOTO, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 18 }}>
                    Please read before making your first prediction.
                </div>

                <div style={{ background: 'var(--progress-bg)', borderRadius: 16, padding: '16px 16px 6px' }}>
                    <div style={bullet}>{dot}<span>The first <b>{maxWinners} players</b> to correctly call a match's exact full-time scoreline <b>share a prize pool ranging from $20 to $100</b>.</span></div>
                    <div style={bullet}>{dot}<span>You share the pool <b>equally</b> with the other correct callers — your position (1st, 2nd, 3rd…) is shown on each match.</span></div>
                    <div style={bullet}>{dot}<span>Only the <b>exact</b> scoreline wins. The earliest correct callers are ranked first, so predict early.</span></div>
                    <div style={bullet}>{dot}<span>Your rank is set by the <b>last time you commit</b> to your final scoreline. Change your prediction and later switch back, and you rejoin at the <b>back of the line</b> — you don't get your earlier position back.</span></div>
                    <div style={bullet}>{dot}<span>Predictions <b>lock at kickoff</b> and can't be changed after that. Extra time counts; penalty shootouts do not.</span></div>
                </div>

                <button onClick={onAgree} disabled={busy} style={{ ...btnPrimary(false), marginTop: 22 }}>
                    {busy ? 'Submitting…' : 'Agree & Submit'}
                </button>
                <button onClick={onDecline} disabled={busy} style={{ width: '100%', marginTop: 10, padding: 15, borderRadius: 20, border: 'none', background: 'none', fontFamily: ROBOTO, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer' }}>
                    I don't agree
                </button>
            </div>
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
                border: `1.5px solid ${PURPLE}`, borderRadius: 20, padding: '15px 0', width: 118, height: 132,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', touchAction: 'none', userSelect: 'none', cursor: 'ns-resize',
            }}
        >
            <button onClick={() => onSet(value + 1)} style={stepBtn()} aria-label="increase score"><ChevronUp size={22} strokeWidth={3} color={PURPLE} /></button>
            <span key={value} className="animate-digit" style={{ fontFamily: HEAD, fontSize: 48, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-main)', lineHeight: 1.0 }}>{value}</span>
            <button onClick={() => onSet(value - 1)} style={stepBtn()} aria-label="decrease score"><ChevronDown size={22} strokeWidth={3} color={PURPLE} /></button>
        </div>
    );
}

const teamCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flexBasis: 0, flexGrow: 1, minWidth: 0 };
const teamName: React.CSSProperties = { fontFamily: HEAD, fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', letterSpacing: '-0.6px', textShadow: '0 1px 4px rgba(0,0,0,0.6)', maxWidth: '100%', wordBreak: 'break-word', lineHeight: 1.15 };
const stepBtn = (): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' });

const ROBOTO = "'Roboto', system-ui, sans-serif";
function btnPrimary(disabled: boolean): React.CSSProperties {
    return {
        width: '100%', padding: 15, borderRadius: 20, border: 'none', fontFamily: ROBOTO, fontSize: 14, fontWeight: 600, color: '#fff',
        cursor: disabled ? 'default' : 'pointer', background: disabled ? '#9ca3af' : '#8A4FFF', opacity: disabled ? 0.9 : 1,
    };
}
function btnMuted(): React.CSSProperties {
    return { width: '100%', padding: 15, borderRadius: 20, border: 'none', fontFamily: ROBOTO, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--progress-bg)', cursor: 'default' };
}
function btnLavender(): React.CSSProperties {
    return { width: '100%', padding: 15, borderRadius: 20, border: 'none', fontFamily: ROBOTO, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#8A4FFF', background: '#EDE4FF' };
}
