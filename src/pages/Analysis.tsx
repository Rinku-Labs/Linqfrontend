import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ArrowLeft, TrendingUp, DollarSign } from 'lucide-react';
import { fetchOrders } from '../utils/ordersCache';
import { AnalysisStatSkeleton } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    BarChart, Bar
} from 'recharts';

// Order interface matching backend response
interface Order {
    id: string;
    amountStableCoin: number;
    amountNgn: number;
    status: string;
    createdAt: string;
    orderType?: string;
    bankName?: string;
    coin?: { sui?: boolean };
}

// Helper to normalize status for filtering (same as Transactions List)
const normalizeStatus = (status: string): string => {
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
        case 'cancelled':
        case 'user_cancelled':
        case 'insufficient_funds':
            return 'failed';
        case 'pending':
        case 'initiated':
        case 'in_order_queue':
        case 'payment_processing':
        case 'processing':
            return 'pending';
        default:
            return 'pending';
    }
};

// Determine the transaction type of an order
const getOrderType = (order: Order): 'On-Ramp' | 'Off-Ramp' | 'Bills' => {
    if (order.orderType === 'bill-payment') return 'Bills';
    const ot = order.orderType?.toLowerCase() || '';
    if (ot === 'on-ramp' || ot === 'onramp' || ot === 'deposit') return 'On-Ramp';
    if (ot === 'off-ramp' || ot === 'offramp' || ot === 'withdrawal') return 'Off-Ramp';
    // Fallback heuristic
    if (order.bankName === 'Linq' || order.coin?.sui) return 'On-Ramp';
    return 'Off-Ramp';
};

// Calculate stats from orders
const calculateStats = (orders: Order[]) => {
    const totalVolume = orders.reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);
    const totalTransactions = orders.length;
    const completedOrders = orders.filter(o => normalizeStatus(o.status) === 'completed');

    const transferVolume = completedOrders.reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);

    return {
        totalVolume,
        totalTransactions,
        transferVolume,
        completedCount: completedOrders.length,
    };
};

const prepareChartData = (orders: Order[], timeFilter: string) => {
    if (!orders.length) return [];

    const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const grouped = new Map<string, number>();

    sorted.forEach(order => {
        if (normalizeStatus(order.status) !== 'completed') return;

        const date = new Date(order.createdAt);
        let key = '';

        if (timeFilter === 'today') {
            key = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        } else if (timeFilter === 'week') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            key = days[date.getDay()];
        } else if (timeFilter === 'month') {
            key = date.getDate().toString();
        } else {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const current = grouped.get(key) || 0;
        grouped.set(key, current + (order.amountStableCoin || 0));
    });

    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
};

// Prepare data for pie chart — transaction type breakdown by volume
const prepareTypeData = (orders: Order[]) => {
    const types = { 'On-Ramp': 0, 'Off-Ramp': 0, 'Bills': 0 };
    orders.forEach(order => {
        const type = getOrderType(order);
        types[type] += (order.amountStableCoin || 0);
    });
    return Object.entries(types)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
};

// Prepare data for bar chart — transaction counts per period
const prepareBarData = (orders: Order[], timeFilter: string) => {
    if (!orders.length) return [];

    const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const grouped = new Map<string, number>();

    sorted.forEach(order => {
        const date = new Date(order.createdAt);
        let key = '';

        if (timeFilter === 'today') {
            key = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        } else if (timeFilter === 'week') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            key = days[date.getDay()];
        } else if (timeFilter === 'month') {
            key = date.getDate().toString();
        } else {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const current = grouped.get(key) || 0;
        grouped.set(key, current + 1);
    });

    return Array.from(grouped.entries()).map(([name, count]) => ({ name, count }));
};

const PIE_COLORS = ['#8b5cf6', '#22c55e', '#f59e0b']; // On-Ramp, Off-Ramp, Bills

export default function Analysis() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<string>('all');

    useEffect(() => {
        const loadOrders = async () => {
            try {
                setIsLoading(true);
                const cachedOrders = await fetchOrders();
                const mappedOrders: Order[] = cachedOrders.map((order: any) => ({
                    id: order.id,
                    amountStableCoin: Number(order.amountStableCoin),
                    amountNgn: order.amountNgn,
                    status: order.status,
                    createdAt: order.createdAt || order.created,
                    orderType: order.orderType,
                    bankName: order.bankName,
                    coin: order.coin,
                }));
                setOrders(mappedOrders);
            } catch (err) {
                console.error('Failed to fetch orders:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadOrders();
    }, []);

    // Filter orders by time
    const filterOrdersByTime = (orders: Order[]) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today.getTime() - 7 * 86400000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        switch (timeFilter) {
            case 'today':
                return orders.filter(o => new Date(o.createdAt) >= today);
            case 'week':
                return orders.filter(o => new Date(o.createdAt) >= thisWeek);
            case 'month':
                return orders.filter(o => new Date(o.createdAt) >= thisMonth);
            default:
                return orders;
        }
    };

    const timeFilteredOrders = filterOrdersByTime(orders);
    // Only show successful (completed) transactions in analytics
    const filteredOrders = timeFilteredOrders.filter(o => normalizeStatus(o.status) === 'completed');
    const stats = calculateStats(filteredOrders);
    const chartData = useMemo(() => prepareChartData(filteredOrders, timeFilter), [filteredOrders, timeFilter]);
    const typeData = useMemo(() => prepareTypeData(filteredOrders), [filteredOrders]);
    const barData = useMemo(() => prepareBarData(timeFilteredOrders, timeFilter), [timeFilteredOrders, timeFilter]);

    // Volume totals for the top glass card
    const totalNgn = filteredOrders.reduce((sum, o) => sum + (o.amountNgn || 0), 0);
    const totalUsd = filteredOrders.reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);

    const statCards = [
        { label: 'Total Volume', value: `$${stats.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
        { label: 'Total Transactions', value: stats.totalTransactions.toString() },
        { label: 'Avg. Transaction', value: stats.totalTransactions > 0 ? `$${(stats.totalVolume / stats.totalTransactions).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '$0' },
        { label: 'Largest Transaction', value: `$${(filteredOrders.length > 0 ? Math.max(...filteredOrders.map(o => o.amountStableCoin || 0)) : 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    ];

    // Calculate total for percentage display in legend
    const typeTotal = typeData.reduce((sum, d) => sum + d.value, 0);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', paddingBottom: '30px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <ArrowLeft size={24} />
                </button>
                <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    margin: 0,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    color: 'var(--text-main)'
                }}>Analytics</h2>
            </div>

            {/* Time Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {[
                    { label: 'All Time', value: 'all' },
                    { label: 'Today', value: 'today' },
                    { label: 'This Week', value: 'week' },
                    { label: 'This Month', value: 'month' }
                ].map(({ label, value }) => (
                    <button
                        key={value}
                        onClick={() => setTimeFilter(value)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '9px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: timeFilter === value ? 'var(--primary)' : 'var(--surface)',
                            color: timeFilter === value ? 'white' : 'var(--text-secondary)',
                            border: timeFilter === value ? 'none' : '1px solid var(--border-color)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <AnalysisStatSkeleton />
            ) : filteredOrders.length === 0 ? (
                <EmptyState
                    icon={BarChart3}
                    title="No data for this period"
                    description="Transaction statistics will appear here. Try selecting a different time period."
                />
            ) : (
                <>
                    {/* Top Volume Glass Card */}
                    <div className="glass-card animate-scaleIn" style={{
                        borderRadius: '24px',
                        padding: '28px 24px',
                        marginBottom: '24px',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}>
                        {/* Decorative glow */}
                        <div style={{
                            position: 'absolute', top: '-40px', right: '-40px',
                            width: '120px', height: '120px',
                            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
                            borderRadius: '50%', pointerEvents: 'none',
                        }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '12px',
                                background: 'rgba(139, 92, 246, 0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <TrendingUp size={18} color="#8b5cf6" />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                Total Volume
                            </span>
                        </div>
                        <h1 style={{
                            fontSize: '28px', fontWeight: 800,
                            color: 'var(--text-main)',
                            marginBottom: '6px',
                            letterSpacing: '-0.5px',
                        }}>
                            ₦{totalNgn.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <DollarSign size={14} color="var(--text-muted)" />
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
                                ≈ ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Volume Area Chart */}
                    <div style={{
                        height: '300px',
                        width: '100%',
                        marginBottom: '24px',
                        background: 'var(--surface-color, rgba(255,255,255,0.05))',
                        borderRadius: '24px',
                        padding: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>Transaction Volume</h3>
                        <ResponsiveContainer width="100%" height={250} minWidth={0}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                    tickFormatter={(value: number) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--surface)',
                                        borderColor: 'var(--border-color)',
                                        color: 'var(--text-main)',
                                        borderRadius: '12px'
                                    }}
                                    itemStyle={{ color: 'var(--text-main)' }}
                                    formatter={(value: any) => [value ? `$${Number(value).toLocaleString()}` : '$0', 'Volume']}
                                />
                                <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 3" opacity={0.3} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="var(--primary)"
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Two-column charts: Pie + Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        {/* Pie Chart — Transaction Types */}
                        <div className="glass-card animate-slideUp" style={{
                            borderRadius: '24px',
                            padding: '16px',
                            border: '1px solid var(--border-color)',
                            animationFillMode: 'backwards',
                            animationDelay: '0.1s',
                        }}>
                            <h3 style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Type Breakdown</h3>
                            {typeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={typeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={60}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {typeData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--surface)',
                                                borderColor: 'var(--border-color)',
                                                color: 'var(--text-main)',
                                                borderRadius: '12px',
                                                fontSize: '10px',
                                            }}
                                            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Volume']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No data</span>
                                </div>
                            )}
                            {/* Legend */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                {typeData.map((entry, i) => (
                                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                                            <span style={{ fontSize: '9px', color: 'var(--text-main)', fontWeight: 500 }}>{entry.name}</span>
                                        </div>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{typeTotal > 0 ? ((entry.value / typeTotal) * 100).toFixed(0) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bar Chart — Transaction Counts */}
                        <div className="glass-card animate-slideUp" style={{
                            borderRadius: '24px',
                            padding: '16px',
                            border: '1px solid var(--border-color)',
                            animationFillMode: 'backwards',
                            animationDelay: '0.2s',
                        }}>
                            <h3 style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Tx Count</h3>
                            {barData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                    <BarChart data={barData}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--surface)',
                                                borderColor: 'var(--border-color)',
                                                color: 'var(--text-main)',
                                                borderRadius: '12px',
                                                fontSize: '10px',
                                            }}
                                            formatter={(value: any) => [value, 'Transactions']}
                                        />
                                        <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No data</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Grid (existing 4 cards) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {statCards.map((stat, index) => (
                            <div key={index} className={`card-interactive animate-scaleIn glass-card`} style={{
                                borderRadius: '24px', padding: '24px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                textAlign: 'center', aspectRatio: '1/0.8',
                                opacity: 0, animationDelay: `${0.05 * (index + 1)}s`, animationFillMode: 'forwards',
                                transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
                            }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: 500, marginBottom: '8px' }}>{stat.label}</p>
                                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>{stat.value}</h2>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
