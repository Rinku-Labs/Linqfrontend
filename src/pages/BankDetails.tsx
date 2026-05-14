import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BankSelector from '../components/ui/BankSelector';
import banksData from '../../banks.json';
import { verifyBankAccount, type VerifyBankError } from '../api/bank';
import { updateBankDetails, getBankDetails, requestBankDetailsOtp } from '../api/user';
import { Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
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
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);
    const [existingDetails, setExistingDetails] = useState<any>(null);
    const [isEditMode, setIsEditMode] = useState(true);
    const [isRequestingOtp, setIsRequestingOtp] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otp, setOtp] = useState('');

    const [isValidating, setIsValidating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Fetch existing details
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await getBankDetails();
                if (res.data && res.data.bankAccount) {
                    setExistingDetails(res.data);
                    setUsername(res.data.username);
                    setAccountNumber(res.data.bankAccount);
                    setBankName(res.data.bankName);
                    setValidatedName(res.data.accountName);
                    setIsEditMode(false);
                } else if (user?.username) {
                    setUsername(user.username);
                }
            } catch (error) {
                if (user?.username) setUsername(user.username);
            } finally {
                setIsLoadingDetails(false);
            }
        };
        fetchDetails();
    }, [user]);

    // Verify Bank Account Logic
    useEffect(() => {
        if (!isEditMode) return;

        const verify = async () => {
            setValidationError('');
            setValidatedName('');

            if (accountNumber.length !== 10 || !bankName) {
                return;
            }

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
    }, [accountNumber, bankName, isEditMode]);

    const handleEditClick = async () => {
        setIsRequestingOtp(true);
        setSaveError('');
        try {
            await requestBankDetailsOtp();
            setShowOtpInput(true);
        } catch (error: any) {
            setSaveError(error.response?.data?.message || "Failed to send OTP");
        } finally {
            setIsRequestingOtp(false);
        }
    };

    const handleVerifyOtp = () => {
        if (otp.length < 4) {
            setSaveError("Please enter a valid OTP");
            return;
        }
        setSaveError('');
        setShowOtpInput(false);
        setIsEditMode(true);
    };

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
                bankAccount: accountNumber,
                otp: existingDetails ? otp : undefined
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

    if (isLoadingDetails) {
        return (
            <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Header title="Bank Details" showBack />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Loader2 className="animate-spin" size={32} color="var(--primary)" />
                </div>
            </div>
        );
    }

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

                    {/* Read-Only View */}
                    {!isEditMode && !showOtpInput && existingDetails && (
                        <div>
                            <div style={{ marginBottom: '16px', background: 'var(--surface)', padding: '16px', borderRadius: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Username</div>
                                <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>@{existingDetails.username}</div>
                            </div>
                            <div style={{ marginBottom: '16px', background: 'var(--surface)', padding: '16px', borderRadius: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Bank</div>
                                <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{existingDetails.bankName}</div>
                            </div>
                            <div style={{ marginBottom: '16px', background: 'var(--surface)', padding: '16px', borderRadius: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Account</div>
                                <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{existingDetails.bankAccount}</div>
                            </div>
                            <div style={{ marginBottom: '24px', background: 'var(--surface)', padding: '16px', borderRadius: '12px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Account Name</div>
                                <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{existingDetails.accountName}</div>
                            </div>

                            <Button 
                                fullWidth 
                                onClick={handleEditClick} 
                                disabled={isRequestingOtp}
                            >
                                {isRequestingOtp ? 'Sending OTP...' : 'Edit Details'}
                            </Button>
                        </div>
                    )}

                    {/* OTP Input View */}
                    {showOtpInput && (
                        <div>
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', padding: '16px',
                                display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '24px'
                            }}>
                                <ShieldAlert size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ color: '#F59E0B', fontSize: '12px', lineHeight: 1.5 }}>
                                    To protect your account, we've sent an OTP to your email. Enter it below to edit your receiving bank details.
                                </span>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <Input
                                    label="Enter OTP"
                                    placeholder="6-digit code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                            </div>

                            <Button 
                                fullWidth 
                                onClick={handleVerifyOtp} 
                                disabled={otp.length < 4}
                            >
                                Verify & Edit
                            </Button>
                        </div>
                    )}

                    {/* Edit Form */}
                    {isEditMode && !showOtpInput && (
                        <div>
                            {existingDetails && (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px',
                                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'
                                }}>
                                    <CheckCircle2 size={16} color="#10B981" />
                                    <span style={{ color: '#10B981', fontSize: '12px' }}>
                                        OTP verified. You can now update your details.
                                    </span>
                                </div>
                            )}

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

                            <Button
                                fullWidth
                                onClick={handleSave}
                                disabled={!username || !accountNumber || !bankName || isValidating || !validatedName || isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Details'}
                            </Button>
                        </div>
                    )}

                    {/* Global Errors / Success messages at the bottom */}
                    {saveError && (
                        <div style={{
                            marginTop: '24px', color: '#ef4444', fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px'
                        }}>
                            {saveError}
                        </div>
                    )}

                    {successMessage && (
                        <div style={{
                            marginTop: '24px', color: '#10B981', fontSize: '10px',
                            background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <CheckCircle2 size={16} />
                            {successMessage}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
