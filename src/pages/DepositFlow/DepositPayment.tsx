import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import { Copy, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOnrampStatus, type OnrampOrderResponse } from '../../api/onramp';
import { formatDate } from '../../utils/dateFormatter';
import { useWebSocket } from '../../hooks/useWebSocket';



export default function DepositPayment() {
    const navigate = useNavigate();
    const location = useLocation();
    const order = location.state?.order as OnrampOrderResponse;

    if (!order) {
        navigate('/');
        return null;
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    const handlePaid = () => {
        navigate('/deposit/status', {
            state: {
                orderId: order.orderId,
                startTime: Date.now()
            }
        });
    };

    // WebSocket Integration
    interface WebSocketMessage {
        orderId: string;
        data: string | { status: string };
    }

    const { lastMessage } = useWebSocket<WebSocketMessage>({ orderId: order.orderId });

    useEffect(() => {
        if (lastMessage && lastMessage.data) {
            console.log("WebSocket Update:", lastMessage);

            let statusStr: string;
            if (typeof lastMessage.data === 'string') {
                statusStr = lastMessage.data;
            } else if (typeof lastMessage.data === 'object' && 'status' in lastMessage.data) {
                statusStr = lastMessage.data.status;
            } else {
                return;
            }

            // Check for completion or other terminal states
            if (['payment_received', 'fiat received', 'sending_crypto', 'processing: sending crypto', 'completed', 'failed', 'expired', 'processing: in crypto queue'].includes(statusStr)) {
                navigate('/deposit/status', {
                    state: {
                        orderId: order.orderId,
                        startTime: Date.now()
                    }
                });
            }
        }
    }, [lastMessage, navigate, order.orderId]);

    // Initial check (keeping just in case user lands on page after it's done)
    useEffect(() => {
        getOnrampStatus(order.orderId).then(statusData => {
            if (['payment_received', 'fiat received', 'sending_crypto', 'processing: sending crypto', 'completed', 'failed', 'expired', 'processing: in crypto queue'].includes(statusData.status)) {
                navigate('/deposit/status', {
                    state: {
                        orderId: order.orderId,
                        startTime: Date.now()
                    }
                });
            }
        }).catch(err => console.error(err));
    }, [order.orderId, navigate]);

    return (
        <div className="page-enter" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px', flexShrink: 0 }}>
                <Header title="Payment Details" showBack />
            </div>

            <div style={{
                flex: 1,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                maxWidth: '600px',
                width: '100%',
                margin: '0 auto',
                overflowY: 'auto'
            }}>

                {/* Warning / Instructions */}
                <div style={{
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                    flexShrink: 0
                }}>
                    <AlertCircle className="text-yellow-500" size={24} style={{ minWidth: '24px' }} />
                    <p style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Please make a transfer of exactly <b>₦{order.amountNgn.toLocaleString()}</b> to the account details below.
                        Do not include any crypto-related words in the transaction description.
                    </p>
                </div>

                {/* Account Details Card */}
                <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', flexShrink: 0 }}>
                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '4px' }}>BSB / Bank Name</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{order.bankName}</p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Account Number</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{
                                fontSize: order.accountNumber.length > 10 ? '20px' : '24px',
                                fontWeight: 700,
                                color: 'var(--text-main)',
                                letterSpacing: '1px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {order.accountNumber}
                            </p>
                            <button
                                onClick={() => copyToClipboard(order.accountNumber, "Account Number")}
                                style={{ background: 'var(--surface-elevated)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)' }}
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Amount to Pay</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{
                                fontSize: order.amountNgn.toString().length > 8 ? '20px' : '24px',
                                fontWeight: 700,
                                color: 'var(--primary)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '17px', fontWeight: 700 }}>₦</span>
                                    {order.amountNgn.toLocaleString()}
                                </div>
                            </p>
                            <button
                                onClick={() => copyToClipboard(order.amountNgn.toString(), "Amount")}
                                style={{ background: 'var(--surface-elevated)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)' }}
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--surface)',
                        borderRadius: '12px',
                        padding: '12px',
                        textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                            Expires at: {formatDate(order.expiresAt)}
                        </p>
                    </div>
                </div>

                {/* Listening Indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: 'auto', marginBottom: '10px' }}>
                    <Loader2 className="animate-spin" size={16} color="var(--primary)" />
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Listening for incoming payment...</p>
                </div>

            </div>

            <div style={{ padding: '20px', background: 'var(--background)', flexShrink: 0, maxWidth: '600px', width: '100%', margin: '0 auto' }}>
                <Button fullWidth onClick={handlePaid}>
                    I have made the payment
                </Button>
            </div>
        </div>
    );
}
