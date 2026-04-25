import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Landmark, Copy } from 'lucide-react';
import Button from './ui/Button';
import ReceiptCard from './ReceiptCard';
import type { Order } from './TransactionPopup';
import { formatStatus, getStatusStyle } from './TransactionPopup';
import { downloadReceiptAsImage } from '../utils/receiptGenerator';
import balanceCardBg from '../assets/balance-card-bg.png';


interface TransactionReceiptProps {
    order?: Order | null;
    onDone?: () => void;
    showDoneButton?: boolean;
    timeTaken?: string;
}

export default function TransactionReceipt({ order, onDone, showDoneButton = true, timeTaken }: TransactionReceiptProps) {
    const navigate = useNavigate();
    const handleDone = onDone || (() => navigate('/'));
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Handle download receipt
    const handleDownloadReceipt = async () => {
        if (!receiptRef.current || !order) return;

        setIsDownloading(true);
        try {
            const filename = `linq-receipt-${order.id?.slice(0, 8) || 'transaction'}.png`;
            await downloadReceiptAsImage(receiptRef.current, filename);
        } catch (error) {
            console.error('Failed to download receipt:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    // Use order data if provided, otherwise show fallback
    // Fix: Sometimes offramp data might be in different fields depending on the API. We'll use fallbacks.
    const accountName = order?.accountName || (order as any)?.bankAccountName || 'N/A';
    const bankAccount = order?.bankAccount || (order as any)?.accountNumber || (order as any)?.bank_account || 'N/A';
    const bankName = order?.bankName || 'N/A';
    const amountNgn = order?.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }) || '0';
    const transactionId = order?.id || 'N/A';
    const dateStr = order?.createdAt || order?.created || '';
    const status = order?.status || 'completed';
    const narration = order?.description || 'FRM Linq User';

    // Copy handlers
    const [copiedRef, setCopiedRef] = useState(false);

    const handleCopyRef = () => {
        navigator.clipboard.writeText(transactionId);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const feeDisplay = order?.profit && order.profit > 0 ? `$${order.profit.toFixed(2)}` : '$0.00';
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
    });
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });
    const fullDate = `${formattedDate} • ${formattedTime}`;

    return (
        <div style={{ padding: '0 20px', paddingBottom: '30px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px', margin: '0 auto' }}>

            {/* Hidden Receipt Card for Download */}
            {order && (
                <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                    <ReceiptCard ref={receiptRef} order={order} />
                </div>
            )}

            {/* Top Purple Glass Amount Card */}
            <div className="glow-on-hover" style={{
                backgroundImage: `url(${balanceCardBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '24px',
                padding: '32px 24px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '20px',
                color: 'white',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <Landmark size={12} strokeWidth={2.5} />
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>Bank Transfer</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                        ₦{amountNgn}
                    </span>
                </div>

                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
                    {fullDate}
                </span>
            </div>

            {/* Details Card */}
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                width: '100%',
                marginBottom: '32px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>Recipient</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)', textAlign: 'right', textTransform: 'uppercase' }}>{accountName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Bank</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>{bankName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Account Number</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>{bankAccount}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Amount</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>₦{amountNgn}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Fee</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>{feeDisplay}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Status</span>
                    <span style={{ fontWeight: 700, fontSize: '10px', color: getStatusStyle(status).color, textTransform: 'uppercase' }}>
                        {formatStatus(status)}
                    </span>
                </div>

                {timeTaken && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Time Taken</span>
                        <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>{timeTaken}</span>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Reference ID</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>
                            {transactionId.length > 22 ? `${transactionId.slice(0, 10)}...${transactionId.slice(-10)}` : transactionId}
                        </span>
                        <button onClick={handleCopyRef} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
                            {copiedRef ? <Check size={12} color="var(--success)" /> : <Copy size={12} color="var(--text-muted)" />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Narration</span>
                    <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-main)' }}>{narration}</span>
                </div>

            </div>

            {/* Actions */}
            <div style={{ width: '100%', display: 'flex', gap: '12px', marginTop: 'auto' }}>
                <Button
                    style={{ flex: 1, background: 'var(--primary)', color: '#ffffff', borderRadius: '16px', height: '52px', fontSize: '12px', fontWeight: 600 }}
                    onClick={handleDownloadReceipt}
                    disabled={isDownloading || !order}
                >
                    {isDownloading ? (
                        <><Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} /> Generating...</>
                    ) : (
                        'View Receipt'
                    )}
                </Button>

                {showDoneButton ? (
                    <Button
                        style={{ flex: 1, background: '#F3F4F6', color: '#000000', borderRadius: '16px', height: '52px', fontSize: '12px', fontWeight: 600 }}
                        onClick={handleDone}
                        variant="ghost"
                    >
                        Done
                    </Button>
                ) : (
                    <Button
                        style={{ flex: 1, background: '#F3F4F6', color: '#000000', borderRadius: '16px', height: '52px', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => { }} // Placeholder for Report
                        variant="ghost"
                    >
                        Report
                    </Button>
                )}
            </div>

        </div>
    );
}
