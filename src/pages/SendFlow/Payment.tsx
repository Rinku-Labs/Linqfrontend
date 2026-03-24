import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';

import Button from '../../components/ui/Button';
import { Loader2, XCircle } from 'lucide-react';

import { mapTransactionStatus } from '../../utils/statusMapping';
import { invalidateOrdersCache } from '../../utils/ordersCache';
import { getOrderStatus } from '../../api/order';
import { playSuccessSound } from '../../utils/audio';
import TransactionReceipt from '../../components/TransactionReceipt';
import type { Order } from '../../components/TransactionPopup';
import { useAuth } from '../../context/AuthContext';

export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();

    const { walletAddress, amount, orderId, confirmState, chain } = location.state || {};

    const [status, setStatus] = useState<'idle' | 'preparing' | 'signing' | 'processing' | 'success' | 'failed' | 'completed' | 'refunded' | 'cancelled'>('processing');
    const [message, setMessage] = useState('Verifying your transaction...');
    const hasInitiatedRef = useRef(false);

    // Timer state
    const startTimeRef = useRef<number>(Date.now());
    const [endTime, setEndTime] = useState<number | null>(null);

    // Redirect if state is missing
    useEffect(() => {
        if (!walletAddress || !amount || !orderId) {
            navigate('/', { replace: true });
        }
    }, [walletAddress, amount, orderId, chain, navigate]);

    // WebSocket Integration
    interface WebSocketMessage {
        orderId: string;
        data: string | { status: string };
    }

    const { token } = useAuth();
    const { lastMessage, isConnected } = useWebSocket<WebSocketMessage>({ orderId, token: token ?? undefined });

    useEffect(() => {
        if (lastMessage) {
            // Determine the status string from various possible message formats
            let statusStr = '';
            const msg = lastMessage as any;

            if (typeof msg === 'string') {
                statusStr = msg;
            } else if (msg && typeof msg === 'object') {
                if ('data' in msg) {
                    const data = msg.data;
                    if (typeof data === 'string') {
                        statusStr = data;
                    } else if (data && typeof data === 'object' && 'status' in data) {
                        statusStr = data.status;
                    }
                } else if ('status' in msg) {
                    statusStr = msg.status;
                }
            }

            if (!statusStr) {
                return;
            }

            const mappedStatus = mapTransactionStatus(statusStr);

            if (mappedStatus === 'completed') {
                if (status !== 'completed') {
                    setStatus('completed');
                    setMessage('Transfer successful! Money sent.');
                    if (!endTime) setEndTime(Date.now());
                    invalidateOrdersCache();
                }
            } else if (mappedStatus === 'failed') {
                if (status !== 'failed') {
                    setStatus('failed');
                    setMessage('Transaction failed. You will be refunded.');
                    hasInitiatedRef.current = false;
                }
            } else if (mappedStatus === 'refunded') {
                if (status !== 'refunded') {
                    setStatus('refunded');
                    setMessage('Transaction was refunded.');
                }
            } else {
                // For intermediate states
                // Prevent reverting from terminal states
                if (status === 'completed' || status === 'failed' || status === 'refunded') {
                    return;
                }

                if (status !== 'processing') setStatus('processing');
                setMessage(statusStr === 'wallet_working' ? 'Verifying transaction...' : 'Processing payment...');
            }
        }
    }, [lastMessage, endTime, status]);

    // Polling Integration (always runs as a safety net, even when WS is connected)
    useEffect(() => {
        if (!orderId) return;

        const checkStatus = async () => {
            // Should stop polling if we reached a terminal state
            if (['completed', 'failed', 'refunded', 'cancelled'].includes(status)) return;

            try {
                const data = await getOrderStatus(orderId);

                if (data && data.status) {
                    const mappedStatus = mapTransactionStatus(data.status);
                    if (mappedStatus === 'completed' && status !== 'completed') {
                        setStatus('completed');
                        setMessage('Transfer successful! Money sent.');
                        if (!endTime) setEndTime(Date.now());
                        invalidateOrdersCache();
                    } else if (mappedStatus === 'failed' && status !== 'failed') {
                        setStatus('failed');
                        setMessage('Transaction failed. You will be refunded.');
                        hasInitiatedRef.current = false;
                    } else if (mappedStatus === 'refunded' && status !== 'refunded') {
                        setStatus('refunded');
                        setMessage('Transaction was refunded.');
                    } else {
                        // For intermediate states via polling
                        if (status !== 'processing') setStatus('processing');
                        setMessage(data.status === 'wallet_working' ? 'Verifying transaction...' : 'Processing payment...');
                    }
                }
            } catch (err) {
            }
        };

        // Always poll as a safety net regardless of WS state.
        // Use shorter interval when WS is disconnected (4s) and longer when connected (12s).
        // This prevents the gap where the WS is reconnecting and polling has stopped.
        const interval = setInterval(checkStatus, isConnected ? 12000 : 4000);
        return () => clearInterval(interval);
    }, [orderId, status, endTime, isConnected]);

    // Play success sound when payment is completed
    useEffect(() => {
        if (status === 'completed') {
            playSuccessSound();
        }
    }, [status]);

    // Construct an Order object for TransactionReceipt
    const orderData: Order = {
        id: orderId || '',
        amountStableCoin: Number(amount),
        amountNgn: confirmState?.ngnAmount || 0,
        bankAccount: confirmState?.accountNumber || '',
        bankName: confirmState?.bankName || '',
        accountName: confirmState?.recipientName || '',
        status: status,
        createdAt: new Date().toISOString(),
        orderType: 'off-ramp'
    };

    // Calculate time taken string
    const getTimeTaken = (): string => {
        if (!endTime) return '';
        const elapsed = Math.round((endTime - startTimeRef.current) / 1000);
        if (elapsed < 60) return `${elapsed}s`;
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {(status === 'preparing' || status === 'signing' || status === 'processing') && <Loader2 className="animate-spin" size={64} style={{ color: 'var(--primary)', margin: '0 auto' }} />}
                {(status === 'failed' || status === 'cancelled') && <XCircle size={64} style={{ color: 'red', margin: '0 auto' }} />}

                {(status === 'completed' || status === 'refunded') ? (
                    <div style={{ width: '100%', maxWidth: '500px', animation: 'fadeIn 0.5s ease-out', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <TransactionReceipt order={orderData} showDoneButton={true} timeTaken={getTimeTaken()} />
                    </div>
                ) : (
                    <>
                        <h2 style={{ marginTop: '24px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {status === 'idle' && 'Initializing...'}
                            {status === 'preparing' && 'Preparing Transaction'}
                            {status === 'signing' && 'Sign Transaction'}
                            {status === 'processing' && 'Processing Payment'}
                            {status === 'failed' && 'Payment Failed'}
                            {status === 'cancelled' && 'Transaction Cancelled'}
                        </h2>
                        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                            {status === 'failed' || status === 'cancelled' ? '' : message}
                        </p>

                        {(status === 'failed' || status === 'cancelled') && confirmState && (
                            <Button onClick={() => navigate('/send/confirm', { state: confirmState })} style={{ marginTop: '20px' }}>Try Again</Button>
                        )}

                        {(status === 'failed' || status === 'cancelled') && (
                            <Button variant="ghost" onClick={() => navigate('/')} style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Return Home</Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
