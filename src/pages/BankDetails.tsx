import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BankSelector from '../components/ui/BankSelector';
import banksData from '../../banks.json';
import { verifyBankAccount, type VerifyBankError } from '../api/bank';
import { updateBankDetails } from '../api/user';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BankDetails() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Form state
    const [username, setUsername] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [bankName, setBankName] = useState('');
    const [validatedName, setValidatedName] = useState('');

    // UI state
    const [isValidating, setIsValidating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Pre-fill data if available (mock for now, or from user context)
    useEffect(() => {
        if (user) {
            // In a real scenario, we might want to fetch existing details first
            // But for now, we assume this is mostly for setting up
            if (user.username) setUsername(user.username);
        }
    }, [user]);

    // Verify Bank Account Logic (copied/adapted from AccountDetails)
    useEffect(() => {
        const verify = async () => {
            // Reset states
            setValidationError('');
            setValidatedName('');

            if (accountNumber.length !== 10 || !bankName) {
                return;
            }

            // Find bank code
            const bank = (banksData.data as { name: string, code: string }[]).find(b => b.name === bankName);
            if (!bank) return;

            setIsValidating(true);
            try {
                const response = await verifyBankAccount(accountNumber, bank.code);
                setValidatedName(response.accountName);
            } catch (error: any) {
                const err = error as VerifyBankError;
                setValidationError(err.message || 'Failed to verify account');
            } finally {
                setIsValidating(false);
            }
        };

        const timeoutId = setTimeout(verify, 500);
        return () => clearTimeout(timeoutId);
    }, [accountNumber, bankName]);

    const handleSave = async () => {
        setSaveError('');
        setSuccessMessage('');
        setIsSaving(true);
        try {
            const bank = (banksData.data as { name: string, code: string }[]).find(b => b.name === bankName);
            if (!bank) throw new Error("Invalid bank selected");

            await updateBankDetails({
                username,
                bankCode: bank.code,
                bankAccount: accountNumber
            });

            setSuccessMessage("Bank details updated successfully!");
            setTimeout(() => {
                navigate('/settings');
            }, 1500);
        } catch (error: any) {
            console.error(error);
            setSaveError(error.response?.data?.message || error.message || "Failed to update details");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Bank Details" showBack />

            <div style={{ padding: '0 20px', flex: 1 }}>
                <div className="glass-card" style={{
                    borderRadius: '24px',
                    padding: '24px',
                    marginBottom: '24px'
                }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '10px' }}>
                        Set up your username and bank details to receive payments easily.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <Input
                            label="Username"
                            placeholder="Enter a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <Input
                            label="Account Number"
                            placeholder="Enter account number"
                            value={accountNumber}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            showCount
                            maxLength={10}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length <= 10) setAccountNumber(val);
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <BankSelector
                            selectedBank={bankName}
                            onSelect={(name) => {
                                setBankName(name);
                                if (name !== bankName) setValidatedName('');
                            }}
                        />
                    </div>

                    {/* Validation Status */}
                    {isValidating && (
                        <div style={{
                            marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px',
                            color: 'var(--text-secondary)', fontSize: '10px'
                        }}>
                            <Loader2 className="animate-spin" size={16} />
                            <span>Verifying account...</span>
                        </div>
                    )}

                    {!isValidating && validationError && (
                        <div style={{
                            marginBottom: '24px', color: '#ef4444', fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px'
                        }}>
                            {validationError}
                        </div>
                    )}

                    {!isValidating && validatedName && (
                        <div style={{
                            background: 'rgba(124, 58, 237, 0.1)', borderRadius: '12px', padding: '16px',
                            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'
                        }}>
                            <CheckCircle2 size={16} color="var(--primary)" fill="rgba(124, 58, 237, 0.2)" />
                            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{validatedName}</span>
                        </div>
                    )}

                    {/* Save Error */}
                    {saveError && (
                        <div style={{
                            marginBottom: '24px', color: '#ef4444', fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px'
                        }}>
                            {saveError}
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div style={{
                            marginBottom: '24px', color: '#10B981', fontSize: '10px',
                            background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <CheckCircle2 size={16} />
                            {successMessage}
                        </div>
                    )}

                    <Button
                        fullWidth
                        onClick={handleSave}
                        disabled={!username || !accountNumber || !bankName || isValidating || !validatedName || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Details'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
