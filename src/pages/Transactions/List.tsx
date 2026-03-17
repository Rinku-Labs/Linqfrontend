import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, Inbox, Search, X, BarChart3, Smartphone } from 'lucide-react';
import TransactionPopup, { formatStatus, getStatusStyle } from '../../components/TransactionPopup';
import type { Order } from '../../components/TransactionPopup';
import { formatDate } from '../../utils/dateFormatter';
import { fetchOrders } from '../../utils/ordersCache';
import { TransactionListSkeleton } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import usePullToRefresh, { PullToRefreshIndicator } from '../../hooks/usePullToRefresh';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';

// Helper to normalize status for filtering
const normalizeStatusForFilter = (status: string): string => {
    const normalized = status?.toLowerCase()?.trim() || '';
    switch (normalized) {
        case 'completed':
        case 'settled in treasury':
        case 'settled_in_treasury':
        case 'disbursed':
        case 'received in treasury':
        case 'received_in_treasury':
            return 'completed';
        case 'failed':
        case 'refunded':
        case 'bill refunded':
            return 'failed';
        case 'pending':
        case 'initiated':
        case 'in_order_queue':
        case 'payment_processing':
        case 'processing':
        case 'waiting for deposit':
        case 'paying bill':
        case 'deposit confirmed':
            return 'pending';
        default:
            return 'pending';
    }
};

// Helper to group transactions by date
const groupByDate = (orders: Order[]) => {
    const groups: { [key: string]: Order[] } = {};

    orders.forEach(order => {
        const dateStr = order.createdAt || order.created || '';
        const orderDate = dateStr ? new Date(dateStr).toDateString() : 'Unknown';
        let label = orderDate;
        if (orderDate === new Date().toDateString()) label = 'Today';
        else if (orderDate === new Date(Date.now() - 86400000).toDateString()) label = 'Yesterday';

        if (!groups[label]) groups[label] = [];
        groups[label].push(order);
    });

    return groups;
};

export default function TransactionsList() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const loadOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchOrders(100);
            setOrders(data);
        } catch (err) {
            console.error('Failed to load orders', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const { user } = useAuth();
    const { lastMessage } = useWebSocket(user?.id ? { userId: user.id.toString() } : undefined);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // specific listener for realtime updates
    useEffect(() => {
        if (lastMessage) {
            // Debounce the loadOrders to prevent rapid re-fetching
            const timeoutId = setTimeout(() => {
                loadOrders();
            }, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [lastMessage, loadOrders]);

    // Pull-to-refresh
    const { isRefreshing, pullDistance, handlers: pullHandlers } = usePullToRefresh({
        onRefresh: loadOrders,
    });



    // Filter and search
    const filteredOrders = useMemo(() => {
        let result = statusFilter === 'all'
            ? orders
            : orders.filter(o => normalizeStatusForFilter(o.status) === statusFilter);

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(o =>
                (o.accountName || '').toLowerCase().includes(q) ||
                (o.bankName || '').toLowerCase().includes(q) ||
                (o.amountStableCoin?.toFixed(2) || '').includes(q) ||
                (o.amountNgn?.toString() || '').includes(q)
            );
        }
        return result;
    }, [orders, statusFilter, searchQuery]);

    // Group by date
    const groupedOrders = groupByDate(filteredOrders);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} {...pullHandlers}>
            <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Transactions</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => navigate('/transactions/analysis')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                    >
                        <BarChart3 size={20} color="var(--text-muted)" />
                    </button>
                    <button
                        onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                    >
                        {showSearch ? <X size={20} color="var(--text-muted)" /> : <Search size={20} color="var(--text-muted)" />}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="search-bar animate-scaleIn" style={{ marginBottom: '16px' }}>
                    <Search size={18} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Search by name, bank, or amount..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                            <X size={16} color="var(--text-muted)" />
                        </button>
                    )}
                </div>
            )}

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {[
                    { label: 'All', value: 'all' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Pending', value: 'pending' },
                    { label: 'Failed', value: 'failed' }
                ].map(({ label, value }) => (
                    <button
                        key={value}
                        onClick={() => setStatusFilter(value)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '9px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: statusFilter === value ? 'var(--primary)' : 'var(--surface)',
                            color: statusFilter === value ? 'white' : 'var(--text-secondary)',
                            border: statusFilter === value ? 'none' : '1px solid var(--border-color)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        {value !== 'all' && (
                            <span className={`status-dot status-dot--${value === 'completed' ? 'completed' : value === 'failed' ? 'failed' : 'pending'}`}
                                style={{ marginRight: '6px', display: statusFilter === value ? 'none' : 'inline-block' }} />
                        )}
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <TransactionListSkeleton count={6} />
            ) : filteredOrders.length === 0 ? (
                <EmptyState
                    icon={searchQuery ? Search : Inbox}
                    title={searchQuery ? 'No results found' : (statusFilter !== 'all' ? `No ${statusFilter} transactions` : 'No transactions yet')}
                    description={searchQuery
                        ? `No transactions matching "${searchQuery}". Try a different search.`
                        : 'Your transaction history will appear here once you make your first transfer.'}
                    actionLabel={!searchQuery && statusFilter === 'all' ? 'Send Money' : undefined}
                    onAction={!searchQuery && statusFilter === 'all' ? () => navigate('/send/details') : undefined}
                />
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {Object.entries(groupedOrders).map(([date, dateOrders]) => (
                        <div key={date}>
                            <p style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {date}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {dateOrders.map((order: Order, index: number) => {
                                    const statusStyle = getStatusStyle(order.status);
                                    const formattedStatus = formatStatus(order.status);
                                    const isPending = formattedStatus === 'Pending' || formattedStatus === 'Processing';
                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="card-interactive animate-fadeIn"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                                                padding: '12px 16px', borderRadius: '16px', background: 'var(--surface)',
                                                boxShadow: 'var(--card-shadow)', transition: 'all 0.2s ease',
                                                opacity: 0, animationDelay: `${0.05 * index}s`, animationFillMode: 'forwards'
                                            }}
                                        >
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: statusStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                {order.orderType === 'bill-payment'
                                                    ? <Smartphone size={18} color={statusStyle.color} />
                                                    : order.coin?.sui
                                                        ? <RefreshCw size={18} color={statusStyle.color} />
                                                        : <ArrowUpRight size={18} color={statusStyle.color} />
                                                }
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {order.accountName || order.bankName || 'Transfer'}
                                                </p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                                        {formatDate(order.createdAt || order.created || '')}
                                                    </span>
                                                    <span className={`status-badge ${isPending ? 'status-badge--pending' : ''}`} style={{
                                                        background: statusStyle.bg, color: statusStyle.color,
                                                        padding: '2px 8px', borderRadius: '6px', fontSize: '9px',
                                                    }}>
                                                        <span className={`status-dot status-dot--${['completed', 'settled', 'disbursed'].includes(formattedStatus.toLowerCase()) ? 'completed' : ['failed', 'refunded'].includes(formattedStatus.toLowerCase()) ? 'failed' : 'pending'}`} />
                                                        {formattedStatus}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)' }}>
                                                    ${order.amountStableCoin?.toFixed(2) || '0.00'}
                                                </p>
                                                <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                                    ₦{order.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }) || '0'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TransactionPopup order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        </div>
    );
}
