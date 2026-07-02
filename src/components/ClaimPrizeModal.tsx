import { X, Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { claimPrize } from '../api/predict';

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
    prizeShareUsd,
    prizePoolUsd,
    savedWallet,
    savedHandle,
    onClose,
    onClaimed,
}: {
    fixtureId: number;
    prizeShareUsd: number;
    prizePoolUsd: number;
    savedWallet?: string;
    savedHandle?: string;
    onClose: () => void;
    onClaimed: () => void;
}) {
    const hasSaved = !!(savedWallet && savedHandle);
    const [wallet, setWallet] = useState(savedWallet ?? '');
    const [handle, setHandle] = useState(savedHandle ?? '');
    // When details are already saved, start locked (read-only) so the user just sees
    // what's on file; "Edit" unlocks the inputs to change them.
    const [editing, setEditing] = useState(!hasSaved);
    const [busy, setBusy] = useState(false);

    async function submit() {
        // Only send wallet/handle when the user is entering or editing them; a plain
        // confirm of saved details sends nothing and reuses what's on file. Both the
        // Sui wallet and the X handle are required.
        const sendCreds = editing;
        if (sendCreds && (!wallet.trim() || !handle.trim())) {
            toast.error('Enter your Sui wallet address and X handle.');
            return;
        }
        setBusy(true);
        try {
            await claimPrize(fixtureId, sendCreds ? wallet.trim() : undefined, sendCreds ? handle.trim() : undefined);
            toast.success('Prize claimed! 🎉');
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
                        <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', marginTop: 8, textShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>${prizeShareUsd}</div>
                        {prizePoolUsd > 0 && (
                            <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 600 }}>your share of the ${prizePoolUsd} prize pool</div>
                        )}
                    </div>
                </div>

                <label style={fieldLabel}>
                    <span>Sui wallet address</span>
                    {hasSaved && !editing && (
                        <button style={editBtn} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
                    )}
                </label>
                <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="Enter sui wallet address"
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

                <button
                    onClick={submit}
                    disabled={busy}
                    style={{ width: '100%', padding: 16, borderRadius: 18, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: busy ? 'default' : 'pointer', background: PURPLE_GRAD, marginTop: 24 }}
                >
                    {busy ? 'Claiming…' : 'Claim prize'}
                </button>
            </div>
        </div>
    );
}
