import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
    if (!isOpen) return null;

    const headingStyle: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--text-main)',
        marginBottom: '10px',
        letterSpacing: '-0.01em',
    };

    const textStyle: React.CSSProperties = {
        fontSize: '10px',
        lineHeight: '1.7',
        color: 'var(--text-secondary)',
        marginBottom: '16px',
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2000,
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />
            {/* Modal Card */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    borderRadius: '24px 24px 0 0',
                    padding: '24px',
                    zIndex: 2001,
                    animation: 'slideUp 0.3s ease-out',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Handle bar */}
                <div style={{
                    width: '40px',
                    height: '4px',
                    background: 'var(--text-muted)',
                    borderRadius: '2px',
                    margin: '0 auto 20px',
                    opacity: 0.5,
                    flexShrink: 0
                }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                            Terms & Conditions
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--surface-elevated)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={18} color="var(--text-secondary)" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }} className="custom-scrollbar">
                    <p style={{ ...textStyle, fontStyle: 'italic', opacity: 0.8 }}>
                        Last updated: March 14, 2026
                    </p>

                    <h4 style={headingStyle}>1. Agreement to Terms</h4>
                    <p style={textStyle}>
                        By accessing or using Linq, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use our services.
                    </p>

                    <h4 style={headingStyle}>2. User Responsibilities & Security</h4>
                    <p style={textStyle}>
                        You are responsible for maintaining the confidentiality of your account credentials, including your password and any OTPs sent to you. You are also solely responsible for securing your wallet's private keys or seed phrases.
                    </p>

                    <h4 style={headingStyle}>3. Regulatory & KYC/AML Compliance</h4>
                    <p style={textStyle}>
                        To comply with financial regulations and Anti-Money Laundering (AML) laws, we may require you to provide accurate personal information, including your National Identification Number (NIN).
                    </p>

                    <h4 style={headingStyle}>4. Risks of Web3 & Cryptocurrency</h4>
                    <p style={textStyle}>
                        Cryptocurrency markets are highly volatile. You acknowledge the inherent risks associated with blockchain technology, including permanent loss of funds due to user error or network failures.
                    </p>

                    <h4 style={headingStyle}>5. Fees & Exchange Rates</h4>
                    <p style={textStyle}>
                        Linq provides exchange rates for on-ramp and off-ramp transactions. These rates fluctuate and include a service margin. Applicable fees will be displayed before confirmation.
                    </p>

                    <h4 style={headingStyle}>6. Prohibited Activities</h4>
                    <p style={textStyle}>
                        You agree not to use Linq for any illegal activities, including but not limited to money laundering, fraud, or the purchase of illegal goods/services.
                    </p>

                    <h4 style={headingStyle}>7. Limitation of Liability</h4>
                    <p style={textStyle}>
                        Linq is not liable for any losses resulting from platform downtime, network congestion, or user error. Our service is provided "as is".
                    </p>

                    <h4 style={headingStyle}>8. Changes to Terms</h4>
                    <p style={textStyle}>
                        We may update these Terms & Conditions from time to time. Continued use of the platform constitutes acceptance of the new terms.
                    </p>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: '20px', flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '16px',
                            background: 'var(--primary)',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        I Understand
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--text-muted);
                    border-radius: 10px;
                    opacity: 0.3;
                }
            `}</style>
        </>,
        document.body
    );
}
