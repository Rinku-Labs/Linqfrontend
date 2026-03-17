import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Layout/Header';
import { Delete } from 'lucide-react';

export default function CreatePin() {
    const navigate = useNavigate();
    const { setTransactionPin } = useAuth();
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');

    const handleNumberClick = (num: number) => {
        setError('');
        if (step === 'create') {
            if (pin.length < 4) {
                const newPin = pin + num;
                setPin(newPin);
                if (newPin.length === 4) {
                    setTimeout(() => setStep('confirm'), 300);
                }
            }
        } else {
            if (confirmPin.length < 4) {
                const newConfirm = confirmPin + num;
                setConfirmPin(newConfirm);
                if (newConfirm.length === 4) {
                    handleConfirm(newConfirm);
                }
            }
        }
    };

    const handleConfirm = (finalConfirm: string) => {
        if (pin === finalConfirm) {
            setTransactionPin(pin);
            navigate('/');
        } else {
            setError("PINs do not match. Try again.");
            setConfirmPin('');
            setPin('');
            setStep('create');
        }
    };

    const handleDelete = () => {
        if (step === 'create') {
            setPin(prev => prev.slice(0, -1));
        } else {
            setConfirmPin(prev => prev.slice(0, -1));
        }
    };

    const renderDots = (value: string) => (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '40px' }}>
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: i < value.length ? 'var(--primary)' : 'var(--input-bg)',
                        border: i < value.length ? 'none' : '1px solid var(--border-color)',
                        transition: 'all 0.2s ease'
                    }}
                />
            ))}
        </div>
    );

    const renderKeypad = () => (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            maxWidth: '300px',
            margin: '0 auto'
        }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    className="btn-animated"
                    style={{
                        height: '72px',
                        borderRadius: '24px',
                        background: 'var(--surface)',
                        border: 'none',
                        fontSize: '17px',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        boxShadow: 'var(--card-shadow)',
                        cursor: 'pointer'
                    }}
                >
                    {num}
                </button>
            ))}
            <div /> {/* Spacer */}
            <button
                onClick={() => handleNumberClick(0)}
                className="btn-animated"
                style={{
                    height: '72px',
                    borderRadius: '24px',
                    background: 'var(--surface)',
                    border: 'none',
                    fontSize: '17px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    boxShadow: 'var(--card-shadow)',
                    cursor: 'pointer'
                }}
            >
                0
            </button>
            <button
                onClick={handleDelete}
                className="btn-animated"
                style={{
                    height: '72px',
                    borderRadius: '24px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                }}
            >
                <Delete size={24} />
            </button>
        </div>
    );

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Setup Security" />

            <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '17px', marginBottom: '8px', color: 'var(--text-main)' }}>
                        {step === 'create' ? 'Create a PIN' : 'Confirm your PIN'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {step === 'create'
                            ? 'Enter 4 digits to secure your transfers'
                            : 'Re-enter your PIN to confirm'}
                    </p>
                </div>

                {renderDots(step === 'create' ? pin : confirmPin)}

                {error && (
                    <p style={{ color: 'var(--error)', textAlign: 'center', marginBottom: '24px', animation: 'shake 0.3s' }}>
                        {error}
                    </p>
                )}

                {renderKeypad()}
            </div>
        </div>
    );
}
