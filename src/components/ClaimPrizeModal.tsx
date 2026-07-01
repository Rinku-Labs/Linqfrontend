import { X } from 'lucide-react';
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

// ClaimPrizeModal collects the Sui wallet + X handle once and claims the prize.
// Shown only when the user has no saved payout details; used by both the predict
// page and the history page so every unclaimed win is claimable.
export default function ClaimPrizeModal({
    fixtureId,
    prizeUsd,
    onClose,
    onClaimed,
}: {
    fixtureId: number;
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
            await claimPrize(fixtureId, wallet.trim(), handle.trim());
            toast.success('Prize claimed! 🎉');
            onClaimed();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not claim prize.';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    }

    const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 };
    const fieldInput: React.CSSProperties = { width: '100%', padding: '15px 16px', borderRadius: 16, border: '1.5px solid var(--border, #d1d5db)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: 15, outline: 'none', boxSizing: 'border-box' };

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
