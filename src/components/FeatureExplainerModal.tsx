import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import Button from './ui/Button';
import type { FeatureKey } from '../hooks/useFeatureDiscovery';

interface ExplainerContent {
    title: string;
    steps: string[];
}

const EXPLAINER_CONTENT: Partial<Record<FeatureKey, ExplainerContent>> = {
    invite: {
        title: 'How to Invite & Earn',
        steps: [
            'Go to the Rewards page and copy your unique referral code.',
            'Share the code with friends — they enter it during sign-up.',
            'When your friend completes a transaction of $5 or more, you both earn XP rewards!',
        ],
    },
    'save-and-save': {
        title: 'How Auto-Save Works',
        steps: [
            'Open the Savings tab from the bottom navigation.',
            'Set a savings percentage — a portion of every transaction is saved automatically.',
            'Track your savings goals and watch your balance grow over time.',
        ],
    },
    'multiple-chain': {
        title: 'Using Multiple Chains',
        steps: [
            'Tap the chain selector at the top of your home screen.',
            'Switch between SUI, Solana, Base, BSC, Aptos, and Tron.',
            'Your balances and transactions update instantly for the selected chain.',
        ],
    },
    swap: {
        title: 'How to Swap Tokens',
        steps: [
            'Tap "Swap" from the quick actions on your dashboard.',
            'Select the token you want to convert and enter the amount.',
            'Review the quote and confirm — your crypto converts to USDC/USDT instantly.',
        ],
    },
};

export default function FeatureExplainerModal() {
    const location = useLocation();
    const [feature, setFeature] = useState<FeatureKey | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const state = location.state as { showFeatureExplainer?: FeatureKey } | null;
        if (state?.showFeatureExplainer) {
            setFeature(state.showFeatureExplainer);
            setVisible(true);
            // Clean up the state so it doesn't re-trigger on re-renders
            window.history.replaceState({}, '');
        }
    }, [location.state]);

    const handleClose = () => {
        setVisible(false);
        setFeature(null);
    };

    if (!visible || !feature) return null;

    const content = EXPLAINER_CONTENT[feature];
    if (!content) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.3s ease-out',
                padding: '24px',
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    maxWidth: '340px',
                    width: '100%',
                    background: 'var(--surface, #fff)',
                    borderRadius: '24px',
                    padding: '32px 24px 24px',
                    animation: 'featurePopupIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3
                    style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginBottom: '20px',
                        textAlign: 'center',
                    }}
                >
                    {content.title}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                    {content.steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <span
                                style={{
                                    flexShrink: 0,
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                }}
                            >
                                {i + 1}
                            </span>
                            <p
                                style={{
                                    fontSize: '14px',
                                    lineHeight: 1.5,
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    paddingTop: '3px',
                                }}
                            >
                                {step}
                            </p>
                        </div>
                    ))}
                </div>

                <Button variant="primary" fullWidth onClick={handleClose}>
                    Got it
                </Button>
            </div>
        </div>,
        document.body
    );
}
