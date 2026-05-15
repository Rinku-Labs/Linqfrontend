import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Search, X, BarChart3, Funnel, Share2 } from 'lucide-react';
import { getTransactionIcon } from '../../utils/transactionIcons';
import TransactionPopup, { formatStatus, getStatusStyle } from '../../components/TransactionPopup';
import type { Order } from '../../components/TransactionPopup';
import { formatDate } from '../../utils/dateFormatter';
import { fetchOrders } from '../../utils/ordersCache';
import { mapTransactionStatus } from '../../utils/statusMapping';
import { TransactionListSkeleton } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import usePullToRefresh, { PullToRefreshIndicator } from '../../hooks/usePullToRefresh';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import StatsShareModal from '../../components/StatsShareModal';

// Helper to normalize status for filtering
const normalizeStatusForFilter = (status: string): string => {
    // Delegate to the shared mapping — returns 'completed' | 'pending' | 'failed'
    return mapTransactionStatus(status);
};

const getOrderChain = (order: Order): string | null => {
    if (!order.coin) return null;
    if (order.coin.sui) return 'sui';
    if (order.coin.solana) return 'solana';
    if (order.coin.base) return 'base';
    if (order.coin.bsc) return 'bsc';
    if (order.coin.aptos) return 'aptos';
    if (order.coin.tron) return 'tron';
    if (order.coin.ethereum) return 'ethereum';
    return null;
};

const getOrderChain = (order: Order): string | null => {
    if (!order.coin) return null;
    if (order.coin.sui) return 'sui';
    if (order.coin.solana) return 'solana';
    if (order.coin.base) return 'base';
    if (order.coin.bsc) return 'bsc';
    if (order.coin.aptos) return 'aptos';
    if (order.coin.tron) return 'tron';
    if (order.coin.ethereum) return 'ethereum';
    return null;
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
    const [chainFilter, setChainFilter] = useState<string>('all');
    const [showChainFilter, setShowChainFilter] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
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

    const { user, token } = useAuth();
    const { lastMessage } = useWebSocket(user?.id ? { userId: user.id.toString(), token: token ?? undefined } : undefined);

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



    const availableChains = useMemo(() => {
        const chains = new Set<string>();
        orders.forEach(o => {
            const c = getOrderChain(o);
            if (c) chains.add(c);
        });
        return Array.from(chains);
    }, [orders]);

    // Filter and search
    const filteredOrders = useMemo(() => {
        let result = statusFilter === 'all'
            ? orders
            : orders.filter(o => normalizeStatusForFilter(o.status) === statusFilter);

        if (chainFilter !== 'all') {
            result = result.filter(o => getOrderChain(o) === chainFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(o => {
                // Fields the user sees on screen
                const visibleFields = [
                    o.accountName,
                    o.bankName,
                    formatStatus(o.status),
                    formatDate(o.createdAt || o.created || ''),
                    o.amountStableCoin?.toFixed(2),
                    o.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
                    o.amountNgn?.toString(),
                ];

                // Hidden but relevant data
                const hiddenFields = [
                    o.id,
                    o.bankAccount,
                    (o as any).accountNumber,
                    (o as any).bank_account,
                    o.description,
                    o.recipientUsername,
                    o.userEmail,
                    o.orderType,
                    o.status, // Raw status
                    (o as any).billType,
                    o.trnxWallet,
                    o.userWalletAddress,
                ];

                return [...visibleFields, ...hiddenFields].some(field =>
                    field?.toString().toLowerCase().includes(q)
                );
            });
        }
        return result;
    }, [orders, statusFilter, chainFilter, searchQuery]);

    // Group by date
    const groupedOrders = groupByDate(filteredOrders);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} {...pullHandlers}>
            <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Transactions</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setShowShareModal(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                    >
                        <Share2 size={20} color="var(--text-muted)" />
                    </button>
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
                    {availableChains.length > 1 && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowChainFilter(v => !v)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', position: 'relative' }}
                            >
                                <Funnel size={20} color={chainFilter !== 'all' ? 'var(--primary)' : 'var(--text-muted)'} />
                                {chainFilter !== 'all' && (
                                    <span style={{
                                        position: 'absolute', top: '4px', right: '4px',
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: 'var(--primary)', border: '2px solid var(--bg-main)',
                                    }} />
                                )}
                            </button>
                            {showChainFilter && (
                                <div style={{
                                    position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
                                    background: 'var(--surface)', borderRadius: '12px',
                                    boxShadow: 'var(--card-shadow)', padding: '8px',
                                    display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px',
                                }}>
                                    {[{ label: 'All Chains', value: 'all' }, ...availableChains.map(c => ({ label: c.toUpperCase(), value: c }))].map(({ label, value }) => (
                                        <button
                                            key={value}
                                            onClick={() => { setChainFilter(value); setShowChainFilter(false); }}
                                            style={{
                                                padding: '8px 12px', borderRadius: '8px', fontSize: '9px',
                                                fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                                                background: chainFilter === value ? 'var(--primary)' : 'transparent',
                                                color: chainFilter === value ? 'white' : 'var(--text-secondary)',
                                                border: 'none', width: '100%',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
                        {label}
                    </button>
                ))}
            </div>

            {/* Chain Filter Pills */}
            {availableChains.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                    {[{ label: 'All Chains', value: 'all' }, ...availableChains.map(c => ({ label: c.toUpperCase(), value: c }))].map(({ label, value }) => (
                        <button
                            key={value}
                            onClick={() => setChainFilter(value)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                fontSize: '9px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: chainFilter === value ? 'var(--primary)' : 'var(--surface)',
                                color: chainFilter === value ? 'white' : 'var(--text-secondary)',
                                border: chainFilter === value ? 'none' : '1px solid var(--border-color)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <TransactionListSkeleton count={6} />
            ) : filteredOrders.length === 0 ? (
                <EmptyState
                    icon={searchQuery ? Search : Inbox}
                    title={searchQuery ? 'No results found' : chainFilter !== 'all' ? `No ${chainFilter.toUpperCase()} transactions` : statusFilter !== 'all' ? `No ${statusFilter} transactions` : 'No transactions yet'}
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
                                    const isPending = formattedStatus === 'Pending';
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
                                                {(() => { const Icon = getTransactionIcon(order); return <Icon size={18} color={statusStyle.color} />; })()}
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
            {showShareModal && (
                <StatsShareModal
                    orders={orders}
                    username={user?.username}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}
