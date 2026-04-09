import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { verifyNIN } from '../api/kyc';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import InlineError from '../components/ui/InlineError';

export default function Verification() {
    const navigate = useNavigate();
    const { user, markVerified, isVerified, isCheckingVerification } = useAuth();
    const [nin, setNin] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (isVerified) {
            navigate('/');
        }
    }, [isVerified, navigate]);

    const verifyNinMutation = useMutation({
        mutationFn: (data: { nin: string; userId: string }) =>
            verifyNIN(data.nin, data.userId),
        onSuccess: (data) => {
            if (data.status === 'verified') {
                // Directly mark user as verified in global state + localStorage
                // We trust the backend response directly, no need to re-fetch status
                // as the verification endpoint reads stale JWT-cached user data
                markVerified();
                setShowSuccess(true);
            }
        },
        onError: () => {
            // error handled via mutation state below
        },
    });

    const handleNinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (nin.length !== 11) return;
        if (!user?.id) return;
        verifyNinMutation.mutate({ nin, userId: user.id.toString() });
    };

    // Extract the error message from the axios error response
    const getErrorMessage = (): string => {
        if (!verifyNinMutation.isError) return '';
        const err = verifyNinMutation.error as any;
        const raw: string =
            err?.response?.data?.error ||
            err?.message ||
            'Failed to verify NIN. Please try again.';
        const lower = raw.toLowerCase();
        if (lower.includes('id authority') || lower.includes('authority is currently unavailable')) {
            return 'Verification is temporarily unavailable. Please try again later.';
        }
        return raw;
    };

    return (
        <div className="page-enter">
            <Header title="Verification" />

            {isCheckingVerification ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
                    <p>Checking verification status...</p>
                </div>
            ) : (
                <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
                    {/* Back button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                        <button
                            onClick={() => navigate('/')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', textAlign: 'center' }}>
                        {/* Icon */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '20px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px auto',
                        }}>
                            <ShieldCheck size={32} color="#10B981" />
                        </div>

                        {/* Title */}
                        <h2 style={{
                            fontSize: '17px',
                            fontWeight: 700,
                            marginBottom: '8px',
                            color: 'var(--text-main)',
                        }}>
                            Verify Identity
                        </h2>

                        {/* Subtitle */}
                        <p style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            marginBottom: '32px',
                            lineHeight: '1.5',
                        }}>
                            Enter your National Identity Number (NIN) to verify your identity. This is a one-time process.
                        </p>

                        {/* NIN Form */}
                        <form onSubmit={handleNinSubmit}>
                            <Input
                                placeholder="Enter 11-digit NIN"
                                value={nin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    setNin(val);
                                }}
                                style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '13px' }}
                                disabled={verifyNinMutation.isPending}
                            />

                            {/* Error display */}
                            {verifyNinMutation.isError && (
                                <InlineError
                                    message={getErrorMessage()}
                                    style={{ marginTop: '8px', marginBottom: '8px' }}
                                />
                            )}

                            {/* NIN digit counter */}
                            <p style={{
                                fontSize: '9px',
                                color: nin.length === 11 ? 'var(--success)' : 'var(--text-muted)',
                                marginTop: '4px',
                                marginBottom: '16px',
                                transition: 'color 0.2s',
                            }}>
                                {nin.length}/11 digits
                            </p>

                            <Button
                                variant="primary"
                                fullWidth
                                type="submit"
                                isLoading={verifyNinMutation.isPending}
                                disabled={nin.length !== 11}
                                style={{ marginTop: '8px' }}
                            >
                                Verify NIN
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== Success Popup Overlay ===== */}
            {showSuccess && (
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
                        {/* Animated check */}
                        <div className="animate-bounceIn" style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.1) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px auto',
                        }}>
                            <CheckCircle2 size={48} color="#10B981" />
                        </div>

                        <h2 style={{
                            fontSize: '17px',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            marginBottom: '12px',
                        }}>
                            Verification Complete!
                        </h2>

                        <p style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            marginBottom: '32px',
                            lineHeight: '1.5',
                        }}>
                            Your identity has been successfully verified. You now have full access to all features.
                        </p>

                        <Button
                            variant="primary"
                            fullWidth
                            onClick={() => navigate('/')}
                            style={{
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                            }}
                        >
                            Go to Dashboard
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
