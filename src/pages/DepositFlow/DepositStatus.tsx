import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import { getOnrampStatus } from '../../api/onramp';
import type { OnrampStatusResponse } from '../../api/onramp';
import { Loader2, Check, X, Clock, RefreshCw, Download } from 'lucide-react';
import { mapTransactionStatus } from '../../utils/statusMapping';
import { formatDuration } from '../../utils/time';
import { invalidateOrdersCache } from '../../utils/ordersCache';
import { playSuccessSound } from '../../utils/audio';
import { useAuth } from '../../context/AuthContext';

export default function DepositStatus() {
    const navigate = useNavigate();
    const location = useLocation();
    const orderId = location.state?.orderId;
    const [statusData, setStatusData] = useState<OnrampStatusResponse | null>(null);
    // const [isPolling, setIsPolling] = useState(true); // Removed polling state

    // Timer state
    const [startTime] = useState<number | null>(location.state?.startTime || null);
    const [endTime, setEndTime] = useState<number | null>(null);

    // Mapped status for UI
    const displayedStatus = statusData ? mapTransactionStatus(statusData.status) : 'processing';

    if (!orderId) {
        // If no order ID, return empty or redirect. 
        // Using effect to redirect to avoid render loop issues if immediate.
        useEffect(() => { navigate('/'); }, [navigate]);
        return null;
    }

    const { token } = useAuth();
    // WebSocket hook
    const { lastMessage } = useWebSocket<OnrampStatusResponse>({ orderId, token: token ?? undefined });

    // Initial load
    useEffect(() => {
        if (orderId) {
            getOnrampStatus(orderId).then(setStatusData).catch(console.error);
        }
    }, [orderId]);

    // Handle WebSocket updates
    useEffect(() => {
        if (lastMessage) {
            // The backend sends { orderId, data } wrapper
            // data can be a string (status) or an object (full order)
            const messageData = (lastMessage as any).data;
            let newStatus = '';

            if (typeof messageData === 'string') {
                newStatus = messageData;
            } else if (messageData && typeof messageData === 'object' && 'status' in messageData) {
                newStatus = messageData.status;
            }

            if (newStatus && statusData) {
                // Only update if status changed
                if (newStatus !== statusData.status) {
                    setStatusData(prev => prev ? { ...prev, status: newStatus as any } : null);

                    const mapped = mapTransactionStatus(newStatus);
                    if (mapped === 'completed' && !endTime) {
                        setEndTime(Date.now());
                        invalidateOrdersCache();
                    }
                }
            } else if (newStatus && !statusData) {
                // If we somehow got WS message before initial load (unlikely but possible)
                // We might not have amount/etc, so we can't fully construct statusData yet.
                // Ideally we fetch it.
                getOnrampStatus(orderId).then(setStatusData).catch(console.error);
            }
        }
    }, [lastMessage, endTime, statusData, orderId]);

    const getStatusContent = () => {
        if (!statusData) return <LoadingView message="Initializing..." />;

        switch (displayedStatus) {
            case 'completed':
                return (
                    <>
                        <AudioTrigger />
                        <SuccessView data={statusData} duration={startTime && endTime ? endTime - startTime : null} />
                    </>
                );
            case 'failed':
                return <FailedView data={statusData} />;
            case 'processing':
                return <ProcessingView />;
            case 'initiated':
            default:
                return <PendingView status={statusData.status} />;
        }
    };

    return (
        <div className="page-enter" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px', flexShrink: 0 }}>
                <Header title="Transaction Status" showBack={false} />
            </div>

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                maxWidth: '600px',
                width: '100%',
                margin: '0 auto',
                overflowY: 'auto'
            }}>
                {getStatusContent()}
            </div>

            {(displayedStatus === 'completed' || displayedStatus === 'failed') && (
                <div style={{ padding: '20px', width: '100%', maxWidth: '600px', margin: '0 auto', flexShrink: 0, display: 'flex', gap: '16px' }}>
                    {displayedStatus === 'completed' && orderId && (
                        <Button
                            variant="ghost"
                            onClick={() => navigate(`/transactions/${orderId}`)}
                            style={{ flex: 1, background: 'var(--surface-elevated)', color: 'var(--text-main)', borderRadius: '16px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Download size={20} />
                                <span>Receipt</span>
                            </div>
                        </Button>
                    )}
                    <Button style={{ flex: 1, borderRadius: '16px' }} onClick={() => navigate('/')}>
                        Go Home
                    </Button>
                </div>
            )}
        </div>
    );
}

// Separate component for Success sound trigger to ensure it only plays when the view is rendered
function AudioTrigger() {
    useEffect(() => {
        playSuccessSound();
    }, []);
    return null;
}

function LoadingView({ message }: { message: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
    );
}

function PendingView({ status }: { status: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', margin: '0 auto',
                border: '4px solid rgba(234, 179, 8, 0.05)'
            }}>
                <Clock className="animate-pulse" size={40} style={{ color: '#EAB308' }} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Awaiting Payment</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                We are checking for your payment. This typically takes a few minutes.
            </p>
            <div style={{
                background: 'var(--surface-elevated)',
                padding: '12px 20px',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <Loader2 className="animate-spin" size={16} color="var(--text-muted)" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Status: {status.replace('_', ' ')}</span>
            </div>
        </div>
    );
}

function ProcessingView() {
    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', margin: '0 auto',
                border: '4px solid rgba(59, 130, 246, 0.05)'
            }}>
                <RefreshCw className="animate-spin" size={40} style={{ color: '#3B82F6' }} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Processing</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
                Payment received! Sending crypto to your wallet...
            </p>
        </div>
    );
}

function SuccessView({ data, duration }: { data: OnrampStatusResponse, duration: number | null }) {
    return (
        <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', margin: '0 auto',
                border: '4px solid rgba(124, 58, 237, 0.1)'
            }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Check color="white" strokeWidth={3} />
                </div>
            </div>

            <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)', textAlign: 'center' }}>Deposit Successful</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '32px', textAlign: 'center' }}>
                Your funds have been deposited.
            </p>

            <div className="glass-card" style={{ borderRadius: '24px', padding: '24px', width: '100%', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Status</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>Completed</span>
                </div>
                {duration && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Time taken</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDuration(duration)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Amount Received</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{Number(data.amount).toFixed(2)} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>Order ID</span>
                    <span style={{ fontWeight: 600, fontSize: '9px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.orderId.slice(0, 18)}...</span>
                </div>
            </div>
        </div>
    );
}

function FailedView({ data }: { data: OnrampStatusResponse }) {
    return (
        <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', margin: '0 auto',
                border: '4px solid rgba(239, 68, 68, 0.05)'
            }}>
                <X size={40} style={{ color: '#EF4444' }} />
            </div>

            <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>Deposit Failed</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '32px' }}>
                Order status: {data.status}
            </p>

            <div className="glass-card" style={{ borderRadius: '24px', padding: '24px', width: '100%', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>Order ID</span>
                    <span style={{ fontWeight: 600, fontSize: '9px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.orderId}</span>
                </div>
            </div>
        </div>
    );
}
