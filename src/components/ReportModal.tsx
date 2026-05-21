import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Phone, MessageSquare, ChevronDown, X, Check, Loader2 } from 'lucide-react';
import client from '../api/client';
import type { Order } from './TransactionPopup';

interface ReportModalProps {
    order: Order;
    onClose: () => void;
}

// Report types tailored to Linq's transaction ecosystem
const REPORT_TYPES: Record<string, { label: string; applies: string[] }> = {
    failed_offramp: {
        label: 'Failed Withdrawal — funds deducted but not received in bank',
        applies: ['offramp', 'off-ramp', 'withdrawal'],
    },
    failed_onramp: {
        label: 'Failed Deposit — payment made but USDC not received',
        applies: ['onramp', 'on-ramp', 'deposit'],
    },
    failed_bill_payment: {
        label: 'Failed Bill Payment — charged but service not delivered',
        applies: ['bill-payment'],
    },
    failed_username_transfer: {
        label: 'Failed Username Transfer — sent to user but not received',
        applies: ['offramp', 'off-ramp', 'withdrawal'],
    },
    failed_swap: {
        label: 'Failed Swap — tokens deducted but not received',
        applies: ['swap'],
    },
    wrong_amount: {
        label: 'Wrong Amount — incorrect amount credited or debited',
        applies: ['all'],
    },
    delayed_transaction: {
        label: 'Delayed Transaction — still pending after a long time',
        applies: ['all'],
    },
    duplicate_charge: {
        label: 'Duplicate Charge — charged twice for the same transaction',
        applies: ['all'],
    },
    other: {
        label: 'Other Issue',
        applies: ['all'],
    },
};

// Determine the order type from the order data
function getOrderType(order: Order): string {
    if (order.orderType) return order.orderType.toLowerCase();
    if (order.billType || (order as any).billCategory) return 'bill-payment';
    if (order.bankName === 'Linq') return 'onramp';
    if (order.recipientUsername && !order.bankName) return 'offramp'; // username transfer
    return 'offramp';
}

// Filter report types based on the order type
function getRelevantReportTypes(order: Order) {
    const orderType = getOrderType(order);
    return Object.entries(REPORT_TYPES).filter(([, config]) =>
        config.applies.includes('all') || config.applies.includes(orderType)
    );
}

export default function ReportModal({ order, onClose }: ReportModalProps) {
    const [step, setStep] = useState<'type' | 'details' | 'success'>('type');
    const [reportType, setReportType] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [existingReport, setExistingReport] = useState<any>(null);

    const relevantTypes = getRelevantReportTypes(order);

    // Check for existing report on mount
    useEffect(() => {
        const checkExistingReport = async () => {
            try {
                const response = await client.get(`/user/report/${order.id}`);
                if (response.data?.data) {
                    const report = response.data.data;
                    setExistingReport(report);
                    setReportType(report.reportType);
                    setPhoneNumber(report.phoneNumber || '');
                    setDescription(report.description || '');
                    setStep('details');
                }
            } catch {
                // No existing report — that's fine
            }
        };
        checkExistingReport();
    }, [order.id]);

    const handleSelectType = (type: string) => {
        setReportType(type);
        setShowTypePicker(false);
        setStep('details');
    };

    const handleSubmit = async () => {
        if (!reportType) return;
        if (reportType === 'other' && !description.trim()) {
            setError('Please describe the issue');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await client.post('/user/report', {
                orderId: order.id,
                reportType,
                phoneNumber,
                description,
            });
            setStep('success');
            // Auto-close after 2 seconds
            setTimeout(() => onClose(), 2000);
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to submit report. Please try again.';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedTypeLabel = reportType ? REPORT_TYPES[reportType]?.label : '';
    const canSubmit = reportType && (reportType !== 'other' || description.trim());

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />

            {/* Main Modal */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 0, left: 0, right: 0,
                    background: 'var(--surface)',
                    borderRadius: '24px 24px 0 0',
                    padding: '24px',
                    zIndex: 1001,
                    animation: 'slideUp 0.3s ease-out',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                }}
            >
                {/* Handle bar */}
                <div style={{
                    width: '40px', height: '4px',
                    background: 'var(--text-muted)',
                    borderRadius: '2px',
                    margin: '0 auto 20px',
                    opacity: 0.5,
                }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <AlertTriangle size={18} color="#ef4444" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                {existingReport ? 'Update Report' : 'Report an Issue'}
                            </h3>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                Transaction {order.id.slice(0, 8)}...{order.id.slice(-6)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'var(--surface-elevated, #f3f4f6)',
                            border: 'none', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                    >
                        <X size={16} color="var(--text-secondary)" />
                    </button>
                </div>

                {/* Success State */}
                {step === 'success' && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '40px 20px', gap: '16px',
                        animation: 'fadeIn 0.3s ease-out',
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Check size={32} color="#22c55e" strokeWidth={2.5} />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                            {existingReport ? 'Report Updated' : 'Report Submitted'}
                        </h3>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '280px' }}>
                            Our team will review your report and get back to you. Thank you for your patience.
                        </p>
                    </div>
                )}

                {/* Type Selection & Details Form */}
                {step !== 'success' && (
                    <>
                        {/* Issue Type Selector */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                                Issue Type
                            </label>
                            <button
                                onClick={() => setShowTypePicker(true)}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border, rgba(128,128,128,0.15))',
                                    background: 'var(--surface-elevated, #f9fafb)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s',
                                }}
                            >
                                <span style={{
                                    fontSize: '11px',
                                    color: reportType ? 'var(--text-main)' : 'var(--text-muted)',
                                    textAlign: 'left',
                                    flex: 1,
                                }}>
                                    {selectedTypeLabel || 'Select an issue type'}
                                </span>
                                <ChevronDown size={16} color="var(--text-muted)" />
                            </button>
                        </div>

                        {/* Details Fields (shown after type is selected) */}
                        {step === 'details' && (
                            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                                {/* Phone Number */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{
                                        fontSize: '11px', fontWeight: 600,
                                        color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px',
                                        marginBottom: '8px',
                                    }}>
                                        <Phone size={13} color="var(--text-muted)" />
                                        Phone Number
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="Enter phone number"
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '14px',
                                            border: '1px solid var(--border, rgba(128,128,128,0.15))',
                                            background: 'var(--surface-elevated, #f9fafb)',
                                            fontSize: '12px',
                                            color: 'var(--text-main)',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border, rgba(128,128,128,0.15))'}
                                    />
                                </div>

                                {/* Description */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        fontSize: '11px', fontWeight: 600,
                                        color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px',
                                        marginBottom: '8px',
                                    }}>
                                        <MessageSquare size={13} color="var(--text-muted)" />
                                        Describe the issue
                                        {reportType === 'other' ? (
                                            <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 400 }}>(required)</span>
                                        ) : (
                                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                                        )}
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Tell us more about the issue..."
                                        rows={3}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '14px',
                                            border: '1px solid var(--border, rgba(128,128,128,0.15))',
                                            background: 'var(--surface-elevated, #f9fafb)',
                                            fontSize: '12px',
                                            color: 'var(--text-main)',
                                            outline: 'none',
                                            resize: 'vertical',
                                            fontFamily: 'inherit',
                                            boxSizing: 'border-box',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border, rgba(128,128,128,0.15))'}
                                    />
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div style={{
                                        padding: '10px 14px', borderRadius: '12px',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        color: '#ef4444', fontSize: '11px',
                                        marginBottom: '16px',
                                    }}>
                                        {error}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={!canSubmit || isSubmitting}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        background: canSubmit && !isSubmitting ? 'var(--primary)' : 'var(--text-muted)',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: canSubmit && !isSubmitting ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        opacity: canSubmit ? 1 : 0.6,
                                        transition: 'opacity 0.2s, background 0.2s',
                                    }}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        existingReport ? 'Update Report' : 'Submit Report'
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Issue Type Picker (nested bottom sheet) */}
            {showTypePicker && (
                <>
                    <div
                        onClick={() => setShowTypePicker(false)}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0, 0, 0, 0.3)',
                            zIndex: 1002,
                            animation: 'fadeIn 0.15s ease-out',
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            bottom: 0, left: 0, right: 0,
                            background: 'var(--surface)',
                            borderRadius: '24px 24px 0 0',
                            padding: '24px',
                            zIndex: 1003,
                            animation: 'slideUp 0.25s ease-out',
                            maxHeight: '60vh',
                            overflowY: 'auto',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                Issue Types
                            </h3>
                            <button
                                onClick={() => setShowTypePicker(false)}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'var(--surface-elevated, #f3f4f6)',
                                    border: 'none', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                }}
                            >
                                <X size={14} color="var(--text-secondary)" />
                            </button>
                        </div>

                        {/* Type List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {relevantTypes.map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => handleSelectType(key)}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: reportType === key ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '12px',
                                        color: reportType === key ? 'var(--primary)' : 'var(--text-main)',
                                        fontWeight: reportType === key ? 600 : 400,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (reportType !== key) e.currentTarget.style.background = 'var(--surface-elevated, #f9fafb)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (reportType !== key) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>,
        document.body
    );
}
