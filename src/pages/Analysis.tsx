import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ArrowLeft, TrendingUp, DollarSign, Download, Share2, X, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { fetchOrders } from '../utils/ordersCache';
import { useSavings } from '../context/SavingsContext';
import { AnalysisStatSkeleton } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import logo from '../assets/logo.png';
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

interface CachedOrder {
    id: string;
    amountStableCoin: number | string;
    amountNgn: number;
    status: string;
    createdAt?: string;
    created?: string;
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
        } else if (timeFilter === '6months' || timeFilter === '1year') {
            key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else if (timeFilter === '2months' || timeFilter === '3months') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + 1);
            key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        } else if (timeFilter === '6months' || timeFilter === '1year') {
            key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else if (timeFilter === '2months' || timeFilter === '3months') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + 1);
            key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const current = grouped.get(key) || 0;
        grouped.set(key, current + 1);
    });

    return Array.from(grouped.entries()).map(([name, count]) => ({ name, count }));
};

const PIE_COLORS = ['#8b5cf6', '#22c55e', '#f59e0b']; // On-Ramp, Off-Ramp, Bills

type ShareCardVariant = 'midnight' | 'clean' | 'plum';

type AnalyticsShareMetric = {
    label: string;
    value: string;
};

type SharingNavigator = Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
};

const shareCardVariants: Array<{ id: ShareCardVariant; label: string }> = [
    { id: 'midnight', label: 'Midnight' },
    { id: 'clean', label: 'Clean' },
    { id: 'plum', label: 'Plum' },
];

const shareCardStyles: Record<ShareCardVariant, {
    background: string;
    color: string;
    muted: string;
    border: string;
    accent: string;
    panel: string;
}> = {
    midnight: {
        background: '#07050F',
        color: '#F9FAFB',
        muted: '#B8A9E8',
        border: '#2A174F',
        accent: '#8B5CF6',
        panel: '#100A1F',
    },
    clean: {
        background: '#FFFFFF',
        color: '#111827',
        muted: '#6B7280',
        border: '#E5E7EB',
        accent: '#7C3AED',
        panel: '#F7F4FF',
    },
    plum: {
        background: '#210B3B',
        color: '#FFFFFF',
        muted: '#D8C7FF',
        border: '#5B21B6',
        accent: '#C4B5FD',
        panel: '#331257',
    },
};

const appUrl = 'https://app.uselinq.xyz';

const formatUsdc = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`;

function AnalyticsShareCard({ metrics, variant }: { metrics: AnalyticsShareMetric[]; variant: ShareCardVariant }) {
    const style = shareCardStyles[variant];

    return (
        <div
            style={{
                width: '100%',
                aspectRatio: '1 / 1.28',
                background: style.background,
                color: style.color,
                border: `1px solid ${style.border}`,
                borderRadius: '22px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                letterSpacing: '0px',
            }}
        >
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '9px',
                                overflow: 'hidden',
                                border: `1px solid ${style.border}`,
                                background: style.panel,
                            }}
                        >
                            <img src={logo} alt="Linq" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 800 }}>Linq</span>
                    </div>
                    <span style={{ fontSize: '7px', color: style.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        30 day recap
                    </span>
                </div>

                <h3 style={{ fontSize: '21px', lineHeight: 1.12, fontWeight: 800, marginBottom: '12px' }}>
                    My Linq stablecoin recap
                </h3>

                <div style={{ display: 'grid', gap: '7px' }}>
                    {metrics.map((metric) => (
                        <div
                            key={metric.label}
                            style={{
                                background: style.panel,
                                border: `1px solid ${style.border}`,
                                borderRadius: '12px',
                                padding: '9px 10px',
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                alignItems: 'center',
                                gap: '10px',
                            }}
                        >
                            <span style={{ fontSize: '8px', color: style.muted, lineHeight: 1.25 }}>{metric.label}</span>
                            <strong
                                style={{
                                    fontSize: metric.value.length > 13 ? '12px' : '13px',
                                    color: metric.value === '0.00 USDC' ? style.muted : style.color,
                                    textAlign: 'right',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {metric.value}
                            </strong>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '10px' }}>
                <span style={{ fontSize: '8px', color: style.muted }}>Built from my Linq activity</span>
                <span style={{ fontSize: '9px', color: style.accent, fontWeight: 800, whiteSpace: 'nowrap' }}>{appUrl.replace('https://', '')}</span>
            </div>
        </div>
    );
}

function AnalyticsShareModal({
    metrics,
    shareText,
    onClose,
}: {
    metrics: AnalyticsShareMetric[];
    shareText: string;
    onClose: () => void;
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [selectedVariant, setSelectedVariant] = useState<ShareCardVariant>('midnight');
    const [isSharing, setIsSharing] = useState(false);

    const createShareFile = async () => {
        if (!cardRef.current) return null;

        const canvas = await html2canvas(cardRef.current, {
            backgroundColor: shareCardStyles[selectedVariant].background,
            scale: 2,
            useCORS: true,
            logging: false,
        });

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png', 0.95);
        });

        if (!blob) return null;
        return new File([blob], `linq-analytics-${selectedVariant}.png`, { type: 'image/png' });
    };

    const downloadCard = async (file: File) => {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = URL.createObjectURL(file);
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleShare = async () => {
        const nav = navigator as SharingNavigator;
        setIsSharing(true);

        try {
            const file = await createShareFile();
            const fileShareData = {
                title: 'My Linq stablecoin recap',
                text: shareText,
                files: file ? [file] : undefined,
            } as ShareData;

            if (nav.share && file && (!nav.canShare || nav.canShare(fileShareData))) {
                await nav.share(fileShareData);
                onClose();
            } else if (nav.share) {
                await nav.share({
                    title: 'My Linq stablecoin recap',
                    text: shareText,
                    url: appUrl,
                });
                onClose();
            } else if (file) {
                await downloadCard(file);
                if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
                onClose();
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
                onClose();
            }
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') {
                console.error('Failed to share analytics card:', error);
            }
        } finally {
            setIsSharing(false);
        }
    };

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.58)',
                backdropFilter: 'blur(6px)',
                padding: '24px',
                animation: 'fadeIn 0.25s ease-out',
            }}
            onClick={onClose}
        >
            <div
                className="animate-scaleIn"
                style={{
                    width: '100%',
                    maxWidth: '380px',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.2)',
                    position: 'relative',
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--input-bg)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X size={16} />
                </button>

                <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', paddingRight: '34px' }}>
                    Share analytics card
                </h2>
                <p style={{ fontSize: '10px', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Pick a style and share your Linq stablecoin recap through your phone share sheet.
                </p>

                <div ref={cardRef} style={{ width: '310px', maxWidth: '100%', margin: '0 auto 14px' }}>
                    <AnalyticsShareCard metrics={metrics} variant={selectedVariant} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                    {shareCardVariants.map((variant) => (
                        <button
                            key={variant.id}
                            type="button"
                            onClick={() => setSelectedVariant(variant.id)}
                            style={{
                                height: '34px',
                                borderRadius: '12px',
                                background: selectedVariant === variant.id ? 'var(--primary)' : 'var(--input-bg)',
                                color: selectedVariant === variant.id ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '9px',
                                fontWeight: 700,
                            }}
                        >
                            {variant.label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing}
                    style={{
                        width: '100%',
                        height: '46px',
                        borderRadius: '14px',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        opacity: isSharing ? 0.7 : 1,
                    }}
                >
                    <Share2 size={16} />
                    {isSharing ? 'Preparing...' : 'Share Card'}
                </button>
            </div>
        </div>,
        document.body
    );
}

export default function Analysis() {
    const navigate = useNavigate();
    const { config: savingsConfig, totalSaved } = useSavings();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<string>('all');
    const [showShareCard, setShowShareCard] = useState(false);
    const [showTimeDropdown, setShowTimeDropdown] = useState(false);
    const timeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadOrders = async () => {
            try {
                setIsLoading(true);
                const cachedOrders = await fetchOrders();
                const mappedOrders: Order[] = (cachedOrders as CachedOrder[]).map((order) => ({
                    id: order.id,
                    amountStableCoin: Number(order.amountStableCoin),
                    amountNgn: order.amountNgn,
                    status: order.status,
                    createdAt: order.createdAt || order.created || '',
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
    const primaryOptions = [
        { label: 'All Time', value: 'all' },
        { label: 'Today', value: 'today' },
        { label: 'This Week', value: 'week' },
    ];
    
    const extendedOptions = [
        { label: '1 Month', value: 'month' },
        { label: '2 Months', value: '2months' },
        { label: '3 Months', value: '3months' },
        { label: '6 Months', value: '6months' },
        { label: '1 Year', value: '1year' },
    ];

    const activeExtended = extendedOptions.find(o => o.value === timeFilter);
    const displayExtendedLabel = activeExtended ? activeExtended.label : '1 Month';
    const isExtendedActive = !!activeExtended;

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
                setShowTimeDropdown(false);
            }
        };
        if (showTimeDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTimeDropdown]);

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
            case '2months': {
                const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                return orders.filter(o => new Date(o.createdAt) >= cutoff);
            }
            case '3months': {
                const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                return orders.filter(o => new Date(o.createdAt) >= cutoff);
            }
            case '6months': {
                const cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                return orders.filter(o => new Date(o.createdAt) >= cutoff);
            }
            case '1year': {
                const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                return orders.filter(o => new Date(o.createdAt) >= cutoff);
            }
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
    const thirtyDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    }, []);
    const completedOrders = useMemo(
        () => orders.filter(o => normalizeStatus(o.status) === 'completed'),
        [orders]
    );
    const lastThirtyDayOrders = useMemo(
        () => completedOrders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo),
        [completedOrders, thirtyDaysAgo]
    );
    const shareMetrics = useMemo(() => {
        const onramped = lastThirtyDayOrders
            .filter(o => getOrderType(o) === 'On-Ramp')
            .reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);
        const offramped = lastThirtyDayOrders
            .filter(o => getOrderType(o) === 'Off-Ramp')
            .reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);
        const utilities = lastThirtyDayOrders
            .filter(o => getOrderType(o) === 'Bills')
            .reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);
        const cumulativeVolume = completedOrders.reduce((sum, o) => sum + (o.amountStableCoin || 0), 0);
        const savedPercentage = cumulativeVolume > 0
            ? (totalSaved / cumulativeVolume) * 100
            : (savingsConfig.enabled ? savingsConfig.percentage : 0);

        return [
            { label: 'USDC offramped in the last 30 days', value: formatUsdc(offramped) },
            { label: 'USDC onramped in the last 30 days', value: formatUsdc(onramped) },
            { label: 'USDC spent on utilities in the last 30 days', value: formatUsdc(utilities) },
            { label: 'Total percentage saved', value: `${Math.max(0, savedPercentage).toFixed(1)}%` },
            { label: 'Cumulative transaction volume', value: formatUsdc(cumulativeVolume) },
        ];
    }, [completedOrders, lastThirtyDayOrders, savingsConfig.enabled, savingsConfig.percentage, totalSaved]);
    const shareText = `My Linq stablecoin recap: ${shareMetrics.map(metric => `${metric.label}: ${metric.value}`).join(', ')}. ${appUrl}`;

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
                <button
                    type="button"
                    onClick={() => setShowShareCard(true)}
                    aria-label="Share analytics card"
                    style={{
                        marginLeft: 'auto',
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    <Download size={18} />
                </button>
            </div>
            {showShareCard && (
                <AnalyticsShareModal
                    metrics={shareMetrics}
                    shareText={shareText}
                    onClose={() => setShowShareCard(false)}
                />
            )}

            {/* Time Filter System */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
                {/* Scrollable Pills Area */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', flex: 1 }}>
                    {primaryOptions.map(({ label, value }) => (
                        <button
                            key={value}
                            onClick={() => {
                                setTimeFilter(value);
                                setShowTimeDropdown(false);
                            }}
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

                    {/* Extended Placeholder Pill (Defaults to 1 Month) */}
                    <button
                        onClick={() => {
                            if (!isExtendedActive) {
                                setTimeFilter('month');
                            } else {
                                setShowTimeDropdown(!showTimeDropdown);
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '9px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: isExtendedActive ? 'var(--primary)' : 'var(--surface)',
                            color: isExtendedActive ? 'white' : 'var(--text-secondary)',
                            border: isExtendedActive ? 'none' : '1px solid var(--border-color)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        {displayExtendedLabel}
                    </button>
                </div>

                {/* Dropdown Trigger (Outside overflow-x to prevent clipping) */}
                <div ref={timeDropdownRef} style={{ position: 'relative', flexShrink: 0, zIndex: 50 }}>
                    <button
                        onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                        style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: showTimeDropdown ? 'rgba(139, 92, 246, 0.1)' : 'var(--surface)',
                            color: showTimeDropdown ? 'var(--primary)' : 'var(--text-secondary)',
                            border: `1px solid ${showTimeDropdown ? 'var(--primary)' : 'var(--border-color)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Plus size={14} style={{ transform: showTimeDropdown ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
                    </button>

                    {/* Dropdown menu */}
                    {showTimeDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            background: 'var(--surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                            padding: '6px',
                            minWidth: '140px',
                            animation: 'fadeIn 0.15s ease-out',
                        }}>
                            {extendedOptions.map(({ label, value }) => (
                                <button
                                    key={value}
                                    onClick={() => {
                                        setTimeFilter(value);
                                        setShowTimeDropdown(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: timeFilter === value ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        background: timeFilter === value ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                                        color: timeFilter === value ? 'var(--primary)' : 'var(--text-main)',
                                        border: 'none',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    {label}
                                    {timeFilter === value && (
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
                                    formatter={(value: unknown) => [value ? `$${Number(value).toLocaleString()}` : '$0', 'Volume']}
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
                                            formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Volume']}
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
                                            formatter={(value: unknown) => [Number(value).toLocaleString(), 'Transactions']}
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
