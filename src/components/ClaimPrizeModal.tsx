import { X, Pencil, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { claimPrize, winShareURL } from '../api/predict';

// READ_SECONDS gates the Claim button so the wallet disclaimer can't be skipped —
// losses to unsupported wallets are unrecoverable, so we force a short read.
const READ_SECONDS = 5;

const PURPLE_GRAD = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

// Confetti draws a handful of static flecks behind the prize amount.
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

// ClaimPrizeModal shows the winner's share (and the pool it came from) and collects
// / confirms the Sui wallet + X handle. Payout details are saved once and reused:
// when the user already has them, the fields are prefilled and locked, with an
// "Edit" toggle to change them. Used by both the predict page and the history page.
export default function ClaimPrizeModal({
    fixtureId,
    predictionId,
    prizeShareUsd,
    prizePoolUsd,
    savedWallet,
    savedHandle,
    homeTeam,
    awayTeam,
    finalHome,
    finalAway,
    competition,
    stage,
    shareGate,
    onClose,
    onClaimed,
}: {
    fixtureId: number;
    predictionId?: number; // prediction id — links the X post at the win-card share page
    prizeShareUsd: number;
    prizePoolUsd: number;
    savedWallet?: string;
    savedHandle?: string;
    // Match details, used to compose the "Share on X" post.
    homeTeam?: string;
    awayTeam?: string;
    finalHome?: number | null;
    finalAway?: number | null;
    competition?: string;
    stage?: string; // override stage code (F/SF/QF/RO16) — drives the round hashtags
    shareGate?: boolean; // when true, winners must share on X + paste the link to claim
    onClose: () => void;
    onClaimed: () => void;
}) {
    const hasSaved = !!(savedWallet && savedHandle);
    const [wallet, setWallet] = useState(savedWallet ?? '');
    const [handle, setHandle] = useState(savedHandle ?? '');
    // When details are already saved, start locked (read-only) so the user just sees
    // what's on file; "Edit" unlocks the inputs to change them.
    const [editing, setEditing] = useState(!hasSaved);
    // Required acknowledgment that the address can receive Sui USDC — only when the
    // user is actually entering/changing an address (a plain re-confirm of saved
    // details already acknowledged once). Prizes lost to unsupported wallets are
    // unrecoverable, so this is a hard gate, not just a disclaimer.
    const [ack, setAck] = useState(false);
    const [busy, setBusy] = useState(false);
    // Countdown so the disclaimer is actually read before the prize can be claimed.
    const [readLeft, setReadLeft] = useState(READ_SECONDS);
    useEffect(() => {
        if (readLeft <= 0) return;
        const t = setTimeout(() => setReadLeft((n) => n - 1), 1000);
        return () => clearTimeout(t);
    }, [readLeft]);

    // Share gate: winners share their win on X, then paste the post link. The admin
    // verifies the post before authorizing the payout.
    const [xPostUrl, setXPostUrl] = useState('');
    const [shared, setShared] = useState(false);

    // roundHashtags returns the round-specific X hashtags for this match. Prefers the
    // stage code (from the backend); falls back to parsing the competition string.
    function roundHashtags(): string[] {
        const code = (stage || competition?.split('>').pop() || '').trim().toUpperCase();
        if (code === 'F' || code === 'FINAL') return ['WorldCupFinal', 'Final', 'WorldCup2026Final'];
        if (code === 'SF' || code === 'SEMI-FINAL') return ['SemiFinals'];
        if (code === 'QF' || code === 'QUARTER-FINAL') return ['QuarterFinals'];
        if (code === 'RO16') return ['RoundOf16'];
        return [];
    }
    function openShare() {
        const matchup = homeTeam && awayTeam ? `${homeTeam} ${finalHome ?? ''}-${finalAway ?? ''} ${awayTeam}` : 'my match';
        const text = `I called ${matchup} exactly and won $${prizeShareUsd} USDC on @uselinq Predict & Win!`;
        const tags = ['WorldCup', ...roundHashtags(), 'Linq', 'FIFA'].filter(Boolean).join(',');
        // Link the post at the win-card share page so the tweet unfurls the branded
        // card (winner handle + prize + match). Falls back to the app if unavailable.
        const url = (predictionId ? winShareURL(predictionId, handle) : '') || 'https://app.uselinq.xyz/predict';
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${tags}`, '_blank', 'noopener');
        setShared(true);
    }
    const postValid = /^https?:\/\/(www\.)?(x|twitter)\.com\/.+/.test(xPostUrl.trim());
    const shareBlocked = !!shareGate && !postValid;

    async function submit() {
        // Only send wallet/handle when the user is entering or editing them; a plain
        // confirm of saved details sends nothing and reuses what's on file. Both the
        // Sui wallet and the X handle are required.
        const sendCreds = editing;
        if (sendCreds && (!wallet.trim() || !handle.trim())) {
            toast.error('Enter your Sui or Solana wallet address and X handle.');
            return;
        }
        if (sendCreds && !ack) {
            toast.error('Please confirm your address supports USDC on Sui or Solana.');
            return;
        }
        if (shareGate && !postValid) {
            toast.error('Share your win on X and paste the post link.');
            return;
        }
        setBusy(true);
        try {
            await claimPrize(fixtureId, sendCreds ? wallet.trim() : undefined, sendCreds ? handle.trim() : undefined, shareGate ? xPostUrl.trim() : undefined);
            toast.success('Claimed! Your prize is awaiting authorization.');
            onClaimed();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not claim prize.';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    }

    const fieldLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 };
    const fieldInput = (locked: boolean): React.CSSProperties => ({
        width: '100%', padding: '15px 16px', borderRadius: 16, border: '1.5px solid var(--border, #d1d5db)',
        background: locked ? 'var(--progress-bg)' : 'var(--surface)', color: locked ? 'var(--text-secondary)' : 'var(--text-main)',
        fontSize: 15, outline: 'none', boxSizing: 'border-box',
    });
    const editBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#8A4FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 };

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            className="animate-fadeIn"
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
            <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)', maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5, color: 'var(--text-main)' }}>CLAIM PRIZE</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="var(--text-main)" />
                    </button>
                </div>

                {/* Prize panel — the winner's share, with the pool it came from */}
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, marginBottom: 22, background: 'linear-gradient(160deg, #7c3aed 0%, #2a1055 100%)', padding: '18px 16px 24px', textAlign: 'center' }}>
                    <Confetti />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 1, padding: '5px 18px', borderRadius: 20 }}>YOU WON</div>
                        <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', marginTop: 8, textShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
                            ${prizeShareUsd}<span style={{ fontSize: 26, fontWeight: 800, marginLeft: 4 }}>USDC</span>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4 }}>receive it on Sui or Solana</div>
                        {prizePoolUsd > 0 && (
                            <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 600, marginTop: 2 }}>your share of the ${prizePoolUsd} prize pool</div>
                        )}
                    </div>
                </div>

                {/* Wallet disclaimer — the FIRST thing after the prize card, before the
                    inputs. Funds sent to unsupported wallets are lost with no refund. */}
                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)', borderRadius: 14, padding: '13px 15px', marginBottom: 20, color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, marginBottom: 8, color: '#B45309' }}>
                        <AlertTriangle size={16} /> Wallet Disclaimer
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 12.8, lineHeight: 1.5 }}>
                        Only submit a <b>decentralized wallet address</b> (e.g. Slush Wallet, Suiet, Phantom, OKX Wallet) that supports <b>USDC on Sui or Solana</b>.
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: 12.8, lineHeight: 1.5 }}>
                        Do <b>NOT</b> submit CEX addresses (Binance, Bybit, Spenda etc.) — most don't support this and <b>your prize will be lost, with no refund.</b>
                    </p>
                    <p style={{ margin: 0, fontSize: 12.8, lineHeight: 1.5 }}>
                        Linq is not responsible for funds sent to unsupported wallets. Double-check before submitting.
                    </p>
                </div>

                <label style={fieldLabel}>
                    <span>Sui or Solana wallet address</span>
                    {hasSaved && !editing && (
                        <button style={editBtn} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
                    )}
                </label>
                <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="Enter your Sui or Solana wallet address"
                    readOnly={hasSaved && !editing}
                    autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    style={fieldInput(hasSaved && !editing)}
                />
                <label style={{ ...fieldLabel, marginTop: 16 }}>X handle</label>
                <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="Enter X handle"
                    readOnly={hasSaved && !editing}
                    autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    style={fieldInput(hasSaved && !editing)}
                />

                {editing && (
                    <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 16, fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, flexShrink: 0, accentColor: '#8A4FFF' }} />
                        <span>I've double-checked — this address supports <b>USDC on Sui or Solana</b> and is <b>not</b> a CEX (exchange) address.</span>
                    </label>
                )}

                {shareGate && (
                    <div style={{ marginTop: 20, borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 18 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Share your win to unlock it</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 12px', lineHeight: 1.45 }}>
                            Post your win on X, then paste the link below. We verify the post before your payout.
                        </div>
                        <button
                            onClick={openShare}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#000', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, padding: '11px 18px', cursor: 'pointer' }}
                        >
                            <span style={{ fontWeight: 900, fontSize: 15 }}>𝕏</span> Share on X
                        </button>
                        <input
                            value={xPostUrl}
                            onChange={(e) => setXPostUrl(e.target.value)}
                            placeholder="Paste the link to your X post"
                            autoCapitalize="off" autoCorrect="off" spellCheck={false}
                            style={{ ...fieldInput(false), marginTop: 12 }}
                        />
                        {shared && xPostUrl.trim() !== '' && !postValid && (
                            <div style={{ fontSize: 12, color: '#B45309', marginTop: 6 }}>That doesn't look like an X post link — paste the link to the post you just made.</div>
                        )}
                    </div>
                )}

                <button
                    onClick={submit}
                    disabled={busy || readLeft > 0 || (editing && !ack) || shareBlocked}
                    style={{ width: '100%', padding: 16, borderRadius: 18, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: busy || readLeft > 0 || (editing && !ack) || shareBlocked ? 'default' : 'pointer', background: PURPLE_GRAD, opacity: busy || readLeft > 0 || (editing && !ack) || shareBlocked ? 0.6 : 1, marginTop: 20 }}
                >
                    {busy ? 'Claiming…' : readLeft > 0 ? `Please read the disclaimer… ${readLeft}s` : shareBlocked ? 'Share on X to unlock' : 'Claim prize'}
                </button>
            </div>
        </div>
    );
}
