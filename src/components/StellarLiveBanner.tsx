import { useState } from 'react';
import { X } from 'lucide-react';
import { useChain } from '../context/ChainContext';
import stellarLogo from '../assets/stellar-logo.png';

const DISMISS_KEY = 'stellarLiveBannerDismissed';

/**
 * Announces that Stellar is live and that payments on it are free.
 *
 * Tapping it switches the active chain rather than only linking somewhere, so
 * the announcement and the action are the same gesture — a banner that only
 * says "we support Stellar now" leaves the user to go and find it.
 *
 * Hidden once dismissed, and once Stellar is already the selected chain: the
 * news is spent at that point, and a permanent bar is just lost screen space.
 */
export default function StellarLiveBanner() {
    const { selectedChain, setSelectedChain } = useChain();
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem(DISMISS_KEY) === '1';
        } catch {
            // Private browsing can throw on access rather than return null.
            return false;
        }
    });

    if (dismissed || selectedChain === 'STELLAR') return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Non-fatal: the banner still hides for this session.
        }
    };

    return (
        <div
            onClick={() => setSelectedChain('STELLAR')}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                marginBottom: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                background: 'linear-gradient(90deg, rgba(138,79,255,0.16), rgba(138,79,255,0.06))',
                border: '1px solid rgba(138,79,255,0.28)',
            }}
        >
            <img
                src={stellarLogo}
                alt=""
                style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Stellar is live — zero fees
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Send USDC on Stellar. Tap to switch.
                </p>
            </div>
            <button
                onClick={(e) => {
                    // Without this the dismiss also switches chain, because the
                    // whole banner is the switch target.
                    e.stopPropagation();
                    dismiss();
                }}
                aria-label="Dismiss"
                style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}
