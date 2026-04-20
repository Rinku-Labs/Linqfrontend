import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

// CoinType represents the blockchain coin selection for an order
export interface CoinType {
    sui?: boolean;
    base?: boolean;
    solana?: boolean;
    ethereum?: boolean;
    aptos?: boolean;
    bsc?: boolean;
    tron?: boolean;
}

// Order interface matching backend response
export interface Order {
    userId?: number;
    id: string;
    orderType?: string;
    bankName?: string;
    bankCode?: string;
    bankAccount?: string;
    accountName?: string;
    userEmail?: string;
    username?: string;
    recipientUsername?: string;
    userWalletAddress?: string;
    amountNgn?: number;
    amountStableCoin?: number;
    currency?: string;
    coin?: CoinType;
    rate?: number;
    idempotencyKey?: string;
    status: string;
    trnxWallet?: string;
    encryptionKey?: string;
    digest?: string;
    description?: string;
    profit?: number;
    selectedProvider?: string;
    attemptCount?: number;
    walletRetryCount?: number;
    failedProviders?: string;
    refundAttemptCount?: number;
    treasuryAttemptCount?: number;
    created?: string;
    createdAt?: string; // Sometimes APIs map created to createdAt
    walletTime?: string;
    bankTime?: string;
    updated?: string;
    billType?: string;
}

// Helper to format status - case-insensitive comparison
export const formatStatus = (status: string) => {
    const normalizedStatus = status?.toLowerCase()?.trim() || '';

    // Handle specific long status messages
    if (normalizedStatus.includes('wallet watcher')) {
        return 'Pending';
    }
    if (normalizedStatus.includes('timeout')) {
        return 'Failed';
    }
    if (normalizedStatus.includes('waiting for deposit')) {
        return 'Pending';
    }
    if (normalizedStatus.includes('treasury worker')) {
        return 'Settled';
    }

    switch (normalizedStatus) {
        case 'completed':
            return 'Completed';
        case 'settled in treasury':
        case 'settled_in_treasury':
        case 'received in treasury':
        case 'received_in_treasury':
            return 'Settled';
        case 'disbursed':
            return 'Disbursed';
        case 'failed':
            return 'Failed';
        case 'refunded':
        case 'bill refunded':
            return 'Refunded';
        case 'pending':
        case 'initiated':
        case 'waiting for deposit':
            return 'Pending';
        case 'in_order_queue':
        case 'payment_processing':
        case 'processing':
        case 'paying bill':
        case 'deposit confirmed':
            return 'Processing';
        default:
            return status || 'Unknown';
    }
};

// Helper to get status color - case-insensitive comparison
export const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase()?.trim() || '';
    if (normalizedStatus.includes('treasury worker')) {
        return 'var(--success)';
    }
    switch (normalizedStatus) {
        case 'completed':
        case 'settled in treasury':
        case 'settled_in_treasury':
        case 'disbursed':
        case 'received in treasury':
        case 'received_in_treasury':
            return 'var(--success)';
        case 'failed':
        case 'refunded':
            return 'var(--error)';
        default:
            return 'var(--warning, #f59e0b)';
    }
};

// Helper to get status style - case-insensitive comparison
export const getStatusStyle = (status: string) => {
    const normalizedStatus = status?.toLowerCase()?.trim() || '';
    if (normalizedStatus.includes('treasury worker')) {
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' };
    }
    switch (normalizedStatus) {
        case 'completed':
        case 'settled in treasury':
        case 'settled_in_treasury':
        case 'disbursed':
        case 'received in treasury':
        case 'received_in_treasury':
            return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' };
        case 'failed':
        case 'refunded':
        case 'bill refunded':
            return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
        case 'pending':
        case 'initiated':
        case 'processing':
            return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
        default:
            return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    }
};

interface TransactionPopupProps {
    order: Order | null;
    onClose: () => void;
}

// Detail Row Component
const DetailRow = ({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: isLast ? 0 : '12px',
        marginBottom: isLast ? 0 : '12px',
        borderBottom: isLast ? 'none' : '1px solid var(--border, rgba(128, 128, 128, 0.1))',
        gap: '12px'
    }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</span>
    </div>
);

export default function TransactionPopup({ order, onClose }: TransactionPopupProps) {
    const [copiedId, setCopiedId] = useState(false);
    const navigate = useNavigate();

    if (!order) return null;

    const handleCopyId = () => {
        navigator.clipboard.writeText(order.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };



    const statusStyle = getStatusStyle(order.status);
    const dateStr = order.createdAt || order.created || '';

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
                    zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out'
                }}
            />
            {/* Popup Card */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    borderRadius: '24px 24px 0 0',
                    padding: '24px',
                    zIndex: 1001,
                    animation: 'slideUp 0.3s ease-out',
                    maxHeight: '80vh',
                    overflowY: 'auto'
                }}
            >
                {/* Handle bar */}
                <div style={{
                    width: '40px',
                    height: '4px',
                    background: 'var(--text-muted)',
                    borderRadius: '2px',
                    margin: '0 auto 20px',
                    opacity: 0.5
                }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        Transaction Details
                    </h3>
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

                {/* Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <span style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '9px',
                        fontWeight: 600,
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        textTransform: 'capitalize'
                    }}>
                        {formatStatus(order.status)}
                    </span>
                </div>

                {/* Amount Display */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <p style={{
                        fontSize: (order.amountStableCoin?.toFixed(2) || '').length > 10 ? '24px' : '32px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginBottom: '4px',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%'
                    }}>
                        ${order.amountStableCoin?.toFixed(2) || '0.00'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        ₦{order.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }) || '0'}
                    </p>
                </div>

                {/* Details Card */}
                <div style={{
                    background: 'var(--surface-elevated)',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    {order.orderType === 'bill-payment' ? (
                        <>
                            <DetailRow label="Item" value={order.accountName || (order as any).bankAccountName || 'N/A'} />
                            <DetailRow label="Network" value={order.bankName || 'N/A'} />
                            <DetailRow label="Date" value={formatDate(dateStr)} />
                            <DetailRow label="Type" value="Bill Payment" isLast />
                        </>
                    ) : (
                        <>
                            <DetailRow label="Recipient" value={order.accountName || (order as any).bankAccountName || 'N/A'} />
                            <DetailRow label="Bank" value={order.bankName || 'N/A'} />
                            <DetailRow label="Account Number" value={order.bankAccount || (order as any).accountNumber || (order as any).bank_account || 'N/A'} />
                            {order.profit != null && order.profit > 0 && (
                                <DetailRow label="Fee" value={`$${order.profit.toFixed(2)}`} />
                            )}
                            <DetailRow label="Date" value={formatDate(dateStr)} />
                            <DetailRow
                                label="Type"
                                value={
                                    (order.orderType?.toLowerCase() === 'off-ramp' || order.orderType?.toLowerCase() === 'offramp' || order.orderType?.toLowerCase() === 'withdrawal')
                                        ? 'Withdrawal (Off-Ramp)'
                                        : (order.orderType?.toLowerCase() === 'on-ramp' || order.orderType?.toLowerCase() === 'onramp' || order.orderType?.toLowerCase() === 'deposit')
                                            ? 'Deposit (On-Ramp)'
                                            : (order.bankName === 'Linq' ? 'Deposit (On-Ramp)' : (order.bankName ? 'Withdrawal (Off-Ramp)' : (order.coin?.sui ? 'Deposit (On-Ramp)' : 'Withdrawal (Off-Ramp)')))
                                }
                                isLast
                            />
                        </>
                    )}
                </div>

                {/* Transaction ID */}
                <div style={{
                    background: 'var(--surface-elevated)',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>Transaction ID</p>
                            <p style={{ fontSize: '9px', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                                {order.id.length > 16 ? `${order.id.slice(0, 8)}...${order.id.slice(-8)}` : order.id}
                            </p>
                        </div>
                        <button
                            onClick={handleCopyId}
                            style={{
                                background: 'var(--surface)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                fontSize: '9px',
                                color: copiedId ? 'var(--success)' : 'var(--text-secondary)'
                            }}
                        >
                            {copiedId ? <Check size={14} /> : <Copy size={14} />}
                            {copiedId ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* View Full Details Button */}
                <button
                    onClick={() => navigate(`/transactions/${order.id}`)}
                    style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '16px',
                        background: 'var(--primary)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                    }}
                >
                    View Full Details
                </button>
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
            `}</style>
        </>,
        document.body
    );
}
