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
import ShareToContactsPopup from '../../components/ShareToContactsPopup';
import type { Order } from '../../components/TransactionPopup';
import { useAuth } from '../../context/AuthContext';
import { cleanDisplayValue } from '../../utils/displayValue';

const FAST_TRANSACTION_PROMPT_MS = 6000;
const SHARE_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const SHARE_PROMPT_STORAGE_KEY = 'linqLastFastTransactionSharePromptAt';
const SHARE_PROMPT_RESET_KEY = 'linqSharePromptResetV3';

export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();

    const { walletAddress, amount, orderId, confirmState, chain } = location.state || {};

    const [status, setStatus] = useState<'idle' | 'preparing' | 'signing' | 'processing' | 'success' | 'failed' | 'completed' | 'refunded' | 'cancelled'>('processing');
    const [message, setMessage] = useState('Verifying your transaction...');
    const [showSharePrompt, setShowSharePrompt] = useState(false);
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

    const { token, user } = useAuth();
    const { lastMessage, isConnected, stop: stopWs } = useWebSocket<WebSocketMessage>({ orderId, token: token ?? undefined });

    useEffect(() => {
        if (!lastMessage) return;
        let statusStr = '';
        const msg = lastMessage as any;

        if (typeof msg === 'string') {
            statusStr = msg;
        } else if (msg && typeof msg === 'object') {
            if ('data' in msg) {
                const data = msg.data;
                if (typeof data === 'string') statusStr = data;
                else if (data && typeof data === 'object' && 'status' in data) statusStr = data.status;
            } else if ('status' in msg) {
                statusStr = msg.status;
            }
        }

        if (!statusStr) return;
        const mappedStatus = mapTransactionStatus(statusStr);

        if (mappedStatus === 'completed' && status !== 'completed') {
            setStatus('completed');
            setMessage('Transfer successful! Money sent.');
            if (!endTime) setEndTime(Date.now());
            invalidateOrdersCache();
            stopWs();
        } else if (mappedStatus === 'failed' && status !== 'failed') {
            setStatus('failed');
            setMessage('Transaction failed. You will be refunded.');
            hasInitiatedRef.current = false;
            stopWs();
        } else if (mappedStatus === 'refunded' && status !== 'refunded') {
            setStatus('refunded');
            setMessage('Transaction was refunded.');
            stopWs();
        } else if (!['completed', 'failed', 'refunded'].includes(status)) {
            if (status !== 'processing') setStatus('processing');
            setMessage(statusStr === 'wallet_working' ? 'Verifying transaction...' : 'Processing payment...');
        }
    }, [lastMessage, endTime, status]);

    // One-shot status check on mount — catches orders already completed before WS connected
    useEffect(() => {
        if (!orderId) return;
        getOrderStatus(orderId).then(data => {
            if (!data?.status) return;
            const mapped = mapTransactionStatus(data.status);
            if (mapped === 'completed') {
                setStatus('completed');
                setMessage('Transfer successful! Money sent.');
                if (!endTime) setEndTime(Date.now());
                invalidateOrdersCache();
                stopWs();
            } else if (mapped === 'failed') {
                setStatus('failed');
                setMessage('Transaction failed. You will be refunded.');
            } else if (mapped === 'refunded') {
                setStatus('refunded');
                setMessage('Transaction was refunded.');
            }
        }).catch(() => { /* WS will cover it */ });
    }, [orderId]);

    // Polling fallback — only runs when WS is disconnected and status is non-terminal
    useEffect(() => {
        if (!orderId) return;
        if (isConnected) return;
        if (['completed', 'failed', 'refunded', 'cancelled'].includes(status)) return;

        const interval = setInterval(() => {
            getOrderStatus(orderId).then(data => {
                if (!data?.status) return;
                const mapped = mapTransactionStatus(data.status);
                if (mapped === 'completed' && status !== 'completed') {
                    setStatus('completed');
                    setMessage('Transfer successful! Money sent.');
                    if (!endTime) setEndTime(Date.now());
                    invalidateOrdersCache();
                    stopWs();
                    clearInterval(interval);
                } else if (mapped === 'failed' && status !== 'failed') {
                    setStatus('failed');
                    setMessage('Transaction failed. You will be refunded.');
                    clearInterval(interval);
                } else if (mapped === 'refunded' && status !== 'refunded') {
                    setStatus('refunded');
                    setMessage('Transaction was refunded.');
                    clearInterval(interval);
                }
            }).catch(() => {});
        }, 8000);

        return () => clearInterval(interval);
    }, [orderId, isConnected, status, endTime]);

    // Play success sound when payment is completed
    useEffect(() => {
        if (status === 'completed') {
            playSuccessSound();
        }
    }, [status]);

    useEffect(() => {
        if (status !== 'completed' || !endTime) return;

        const elapsedMs = endTime - startTimeRef.current;
        if (elapsedMs >= FAST_TRANSACTION_PROMPT_MS) return;

        if (localStorage.getItem(SHARE_PROMPT_RESET_KEY) !== 'true') {
            localStorage.removeItem(SHARE_PROMPT_STORAGE_KEY);
            localStorage.setItem(SHARE_PROMPT_RESET_KEY, 'true');
        }

        const lastPromptAt = Number(localStorage.getItem(SHARE_PROMPT_STORAGE_KEY) || 0);
        const now = Date.now();
        if (now - lastPromptAt < SHARE_PROMPT_COOLDOWN_MS) return;

        localStorage.setItem(SHARE_PROMPT_STORAGE_KEY, String(now));
        setShowSharePrompt(true);
    }, [status, endTime]);

    // Construct an Order object for TransactionReceipt
    const recipientUsername = cleanDisplayValue(confirmState?.recipientUsername);
    const orderData: Order = {
        id: orderId || '',
        amountStableCoin: Number(amount),
        amountNgn: confirmState?.ngnAmount || 0,
        bankAccount: cleanDisplayValue(confirmState?.accountNumber),
        bankName: cleanDisplayValue(confirmState?.bankName),
        accountName: cleanDisplayValue(confirmState?.recipientName) || (recipientUsername ? `@${recipientUsername}` : ''),
        recipientUsername,
        description: confirmState?.description || '',
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
            {showSharePrompt && (
                <ShareToContactsPopup
                    username={user?.username}
                    onClose={() => setShowSharePrompt(false)}
                />
            )}
        </div>
    );
}
