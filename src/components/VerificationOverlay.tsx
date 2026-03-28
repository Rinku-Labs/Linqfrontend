import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';

interface VerificationOverlayProps {
    isVerified: boolean;
    isCheckingVerification?: boolean;
    hasTrialRemaining?: boolean;
}

export default function VerificationOverlay({ isVerified, isCheckingVerification, hasTrialRemaining }: VerificationOverlayProps) {
    const navigate = useNavigate();

    // Don't block if verified, still checking, or user has trial volume remaining
    if (isVerified || isCheckingVerification || hasTrialRemaining) return null;

    const handleLogout = () => {
        localStorage.removeItem('linqAuthToken');
        localStorage.removeItem('linqUser');
        window.location.href = '/onboarding';
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '24px',
        }}>
            <div className="animate-scaleIn" style={{
                background: 'var(--surface)',
                padding: '40px 32px',
                borderRadius: '28px',
                maxWidth: '90%',
                width: '400px',
                textAlign: 'center',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border-color)',
            }}>
                {/* Icon */}
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto',
                }}>
                    <ShieldAlert size={36} color="#f59e0b" />
                </div>

                {/* Heading */}
                <h2 style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    marginBottom: '12px',
                    color: 'var(--text-main)',
                }}>
                    Identity Verification Required
                </h2>

                {/* Description */}
                <p style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    marginBottom: '32px',
                    lineHeight: '1.6',
                }}>
                    To keep our platform safe, all users must verify their identity before accessing features. This only takes a minute.
                </p>

                {/* Verify Button */}
                <button
                    onClick={() => navigate('/verification')}
                    style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '16px',
                        border: 'none',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(139, 92, 246, 0.35)',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                    }}
                >
                    <ShieldAlert size={20} />
                    Verify Now
                </button>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--error)',
                        fontSize: '10px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        marginTop: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        opacity: 0.8,
                        transition: 'opacity 0.2s',
                    }}
                >
                    <LogOut size={16} />
                    Log out
                </button>
            </div>
        </div>
    );
}
