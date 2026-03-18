import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import TransactionReceipt from '../../components/TransactionReceipt';
import Header from '../../components/Layout/Header';
import { Loader2 } from 'lucide-react';
import type { Order } from '../../components/TransactionPopup';
import { getCachedOrders } from '../../utils/ordersCache';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function TransactionDetail() {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            // Try to get from cache first
            const cached = getCachedOrders();
            if (cached) {
                const found = cached.orders.find((o: Order) => o.id === id);
                if (found) {
                    setOrder(found);
                    setIsLoading(false);
                    return;
                }
            }
            // Fallback: fetch from API
            try {
                const response = await client.get('/user/orders');
                if (response.data?.data) {
                    const found = response.data.data.find((o: any) => o.id === id);
                    if (found) {
                        setOrder({
                            ...found,
                            createdAt: found.createdAt || found.created,
                            amountStableCoin: Number(found.amountStableCoin),
                            amountNgn: found.amountNgn
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to fetch order:', e);
            }
            setIsLoading(false);
        };
        fetchOrder();
    }, [id]);

    const { token } = useAuth();
    // WebSocket Integration
    const { lastMessage } = useWebSocket<Order>(id ? { orderId: id, token: token ?? undefined } : undefined);

    useEffect(() => {
        if (lastMessage) {
            const newData = lastMessage;
            setOrder(prev => {
                if (!prev) return newData;
                // Merge or replace
                return {
                    ...prev,
                    ...newData,
                    // Ensure dates are preserved or updated correctly
                    createdAt: newData.createdAt || newData.created || prev.createdAt
                };
            });
        }
    }, [lastMessage]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Transaction Details" showBack />
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Loader2 className="spin" size={32} color="var(--primary)" />
                </div>
            ) : (
                <TransactionReceipt order={order} showDoneButton={false} />
            )}
        </div>
    );
}
