import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

interface TransactionPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    validatePin: (pin: string) => Promise<boolean>;
}

export default function TransactionPinModal({ isOpen, onClose, onSuccess, validatePin }: TransactionPinModalProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
        }
    }, [isOpen]);

    const handleNumberClick = (num: number) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            setError('');
            if (newPin.length === 4) {
                // Auto-submit when 4 digits are entered
                verifyPin(newPin);
            }
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const verifyPin = async (pinToVerify: string) => {
        setIsVerifying(true);
        try {
            const isValid = await validatePin(pinToVerify);
            if (isValid) {
                onSuccess();
            } else {
                setError('Incorrect PIN');
                setPin('');
            }
        } catch (e) {
            console.error(e);
            setError('Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <div style={{
                background: 'var(--surface)',
                borderRadius: '32px',
                padding: '32px',
                width: '100%',
                maxWidth: '360px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                position: 'relative',
                color: 'var(--text-main)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '24px',
                        left: '24px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        padding: '8px'
                    }}
                >
                    <ArrowLeft size={24} />
                </button>

                <h3 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '32px',
                    marginTop: '8px'
                }}>
                    Enter your PIN
                </h3>

                {/* PIN Squares */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    marginBottom: '40px'
                }}>
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            border: `2px solid ${i < pin.length ? 'var(--primary)' : 'var(--border-color)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '17px',
                            fontWeight: 'bold',
                            backgroundColor: 'var(--input-bg)',
                            color: 'var(--text-main)',
                            transition: 'all 0.2s ease'
                        }}>
                            {i < pin.length && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-main)' }}></div>}
                        </div>
                    ))}
                </div>

                {error && (
                    <p style={{ color: 'var(--error)', marginBottom: '24px', fontSize: '10px', animation: 'shake 0.3s' }}>
                        {error}
                    </p>
                )}

                {/* Keypad */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '24px',
                    marginBottom: '32px'
                }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num)}
                            disabled={isVerifying}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '17px',
                                fontWeight: 600,
                                color: 'var(--text-main)',
                                cursor: isVerifying ? 'wait' : 'pointer',
                                padding: '12px',
                                borderRadius: '50%',
                                transition: 'background 0.2s'
                            }}
                            className="keypad-btn"
                        >
                            {num}
                        </button>
                    ))}
                    <div /> {/* Empty slot */}
                    <button
                        onClick={() => handleNumberClick(0)}
                        disabled={isVerifying}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '17px',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            cursor: isVerifying ? 'wait' : 'pointer',
                            padding: '12px',
                            borderRadius: '50%',
                            transition: 'background 0.2s'
                        }}
                        className="keypad-btn"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isVerifying}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-main)',
                            cursor: isVerifying ? 'wait' : 'pointer',
                            padding: '12px'
                        }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>

                <button
                    onClick={() => alert("Navigate to forgot PIN flow")}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        marginTop: '8px'
                    }}
                >
                    Forgot PIN?
                </button>
            </div>
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .keypad-btn:active {
                    background: rgba(255, 255, 255, 0.1) !important;
                }
            `}</style>
        </div>
    );
}
