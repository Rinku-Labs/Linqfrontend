import { useState, useMemo, useEffect } from 'react';
import { PiggyBank, TrendingUp, AlertTriangle, ArrowDownToLine, Wallet, Trash2, Eye, EyeOff } from 'lucide-react';
import FeatureExplainerModal from '../components/FeatureExplainerModal';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSavings } from '../context/SavingsContext';
import { useChain } from '../context/ChainContext';
import { fetchRate } from '../utils/rateCache';
import ChainSelector from '../components/ChainSelector';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

export default function Savings() {
    const { config, updateConfig, history, totalSaved } = useSavings();
    const { selectedChain } = useChain();
    const [addressInput, setAddressInput] = useState(config.savingsAddress || '');
    const [percentageInput, setPercentageInput] = useState(config.percentage);
    const [showSetup, setShowSetup] = useState(!config.enabled);
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [showBalance, setShowBalance] = useState(true);

    // Sync inputs when chain/config changes
    useEffect(() => {
        setAddressInput(config.savingsAddress || '');
        setPercentageInput(config.percentage);
        setShowSetup(!config.enabled);
    }, [config, selectedChain]);

    // Fetch exchange rate
    useEffect(() => {
        fetchRate().then(setExchangeRate).catch(() => setExchangeRate(0));
    }, []);

    // Prepare chart data — cumulative savings over time
    const chartData = useMemo(() => {
        if (!history.length) return [];

        const sorted = [...history]
            .filter(e => e.status === 'completed')
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        let cumulative = 0;
        const points: { name: string; saved: number }[] = [];

        sorted.forEach(entry => {
            cumulative += entry.amount;
            const date = new Date(entry.createdAt);
            points.push({
                name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                saved: parseFloat(cumulative.toFixed(2)),
            });
        });

        return points;
    }, [history]);

    const handleSaveConfig = () => {
        if (!addressInput.trim()) return;
        updateConfig({
            enabled: true,
            percentage: percentageInput,
            savingsAddress: addressInput.trim(),
        });
        setShowSetup(false);
    };

    const handleDisable = () => {
        updateConfig({ enabled: false });
        setShowSetup(true);
    };

    const nairaEquivalent = totalSaved * exchangeRate;

    return (
        <div className="page-enter" style={{ paddingBottom: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <PiggyBank size={22} color="white" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Savings</h2>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Spend as you save</p>
                    </div>
                </div>
                <ChainSelector />
            </div>

            {/* ═══ Total Savings Hero Card ═══ */}
            <div className="glow-on-hover animate-slideUp" style={{
                background: 'linear-gradient(135deg, #6D28D9, #8B5CF6, #A78BFA)',
                borderRadius: '24px', padding: '32px 24px', color: 'white', marginBottom: '24px',
                position: 'relative', overflow: 'hidden'
            }}>
                {/* Decorative circles */}
                <div style={{
                    position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px',
                    borderRadius: '50%', background: 'rgba(255,255,255,0.08)'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px',
                    borderRadius: '50%', background: 'rgba(255,255,255,0.06)'
                }} />

                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                        Total Saved • {selectedChain}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <h1 style={{ fontSize: '29px', fontWeight: 700 }}>
                            {showBalance ? `$${totalSaved.toFixed(2)}` : '•••••'}
                        </h1>
                        <button onClick={() => setShowBalance(!showBalance)} style={{
                            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer'
                        }}>
                            {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    {showBalance && exchangeRate > 0 && (
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                            ≈ ₦{nairaEquivalent.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}
                    {config.enabled && (
                        <div style={{
                            marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '6px 14px'
                        }}>
                            <TrendingUp size={14} />
                            <span style={{ fontSize: '9px', fontWeight: 500 }}>
                                Saving {config.percentage}% per transaction
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Savings Graph ═══ */}
            {history.length > 0 && (
                <div className="glass-card animate-slideUp stagger-1" style={{
                    borderRadius: '24px', padding: '20px', marginBottom: '24px',
                    transition: 'background-color 0.3s ease'
                }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                        Savings Growth
                    </h3>
                    <div style={{ height: '200px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                    tickFormatter={(v: number) => `$${v}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--surface)', borderColor: 'var(--border-color)',
                                        color: 'var(--text-main)', borderRadius: '12px', fontSize: '9px'
                                    }}
                                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Total Saved']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="saved"
                                    stroke="var(--primary)"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#savingsGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ═══ Auto-Save Configuration ═══ */}
            <div className="glass-card animate-slideUp stagger-2" style={{
                borderRadius: '24px', padding: '24px', marginBottom: '24px',
                transition: 'background-color 0.3s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Auto-Save Setup</h3>
                    {config.enabled && (
                        <button onClick={handleDisable} style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px',
                            padding: '6px 12px', fontSize: '9px', fontWeight: 500, color: 'var(--error)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                            <Trash2 size={12} /> Disable
                        </button>
                    )}
                </div>

                {config.enabled && !showSetup ? (
                    /* Active config summary */
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Status</span>
                            <span style={{
                                color: 'var(--success)', fontSize: '10px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                                Active
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Save Rate</span>
                            <span style={{ color: 'var(--text-main)', fontSize: '10px', fontWeight: 600 }}>{config.percentage}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Savings Address</span>
                            <span style={{
                                color: 'var(--text-main)', fontSize: '9px', fontWeight: 500,
                                maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {config.savingsAddress}
                            </span>
                        </div>
                        <button onClick={() => setShowSetup(true)} style={{
                            width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)',
                            background: 'var(--surface)', color: 'var(--text-main)', fontSize: '10px',
                            fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease'
                        }}>
                            Edit Settings
                        </button>
                    </div>
                ) : (
                    /* Setup form */
                    <div>
                        {/* Gas fee warning */}
                        <div style={{
                            display: 'flex', gap: '10px', padding: '14px', borderRadius: '14px',
                            background: 'rgba(245, 158, 11, 0.08)', marginBottom: '20px',
                            border: '1px solid rgba(245, 158, 11, 0.2)'
                        }}>
                            <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Each auto-save creates an additional on-chain transaction with its own gas fee.
                                Fees vary by chain — TRON and EVM chains may have higher costs.
                            </p>
                        </div>

                        {/* Percentage slider */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label style={{ fontSize: '10px', color: 'var(--text-main)', fontWeight: 500 }}>
                                    Save Percentage
                                </label>
                                <span style={{
                                    fontSize: '11px', fontWeight: 700, color: 'var(--primary)',
                                    minWidth: '42px', textAlign: 'right'
                                }}>
                                    {percentageInput}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={50}
                                value={percentageInput}
                                onChange={(e) => setPercentageInput(Number(e.target.value))}
                                style={{
                                    width: '100%', height: '6px', borderRadius: '3px',
                                    appearance: 'none', WebkitAppearance: 'none',
                                    background: `linear-gradient(to right, var(--primary) ${(percentageInput / 50) * 100}%, var(--progress-bg) ${(percentageInput / 50) * 100}%)`,
                                    outline: 'none', cursor: 'pointer'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>1%</span>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>50%</span>
                            </div>
                        </div>

                        {/* Savings address input */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-main)', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                                <Wallet size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                Savings Wallet Address
                            </label>
                            <input
                                type="text"
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
                                placeholder={`Enter your ${selectedChain} savings address`}
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '14px',
                                    border: '1.5px solid var(--border-color)', background: 'var(--input-bg)',
                                    color: 'var(--text-main)', fontSize: '10px', fontFamily: 'inherit',
                                    transition: 'border-color 0.2s ease', outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                            />
                            <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Enter a wallet address you control on {selectedChain}. Savings will be transferred here during each transaction.
                            </p>
                        </div>

                        <Button
                            fullWidth
                            onClick={handleSaveConfig}
                            disabled={!addressInput.trim()}
                        >
                            {config.enabled ? 'Update Settings' : 'Enable Auto-Save'}
                        </Button>
                    </div>
                )}
            </div>

            {/* ═══ Withdraw Info ═══ */}
            {totalSaved > 0 && (
                <div className="glass-card animate-slideUp stagger-3" style={{
                    borderRadius: '24px', padding: '20px', marginBottom: '24px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    transition: 'background-color 0.3s ease'
                }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <ArrowDownToLine size={20} color="var(--success)" />
                    </div>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
                            Withdraw Savings
                        </p>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Your savings are in your own wallet. Use your wallet app to transfer funds from your savings address anytime.
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ Savings History ═══ */}
            <div className="glass-card animate-slideUp stagger-4" style={{
                borderRadius: '24px', padding: '24px', marginBottom: '24px',
                transition: 'background-color 0.3s ease'
            }}>
                <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '20px' }}>
                    Savings History
                </h3>

                {history.length === 0 ? (
                    <EmptyState
                        icon={PiggyBank}
                        title="No savings yet"
                        description="Your auto-saved amounts will appear here after your first transaction with savings enabled."
                        variant="inline"
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {history
                            .filter(entry => entry.status !== 'no deposit found')
                            .slice(0, 20)
                            .map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={`animate-fadeIn stagger-${Math.min(index + 1, 8)}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        opacity: 0, animationFillMode: 'forwards', animationDelay: `${0.05 * (index + 1)}s`
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: entry.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            <PiggyBank size={16} color={entry.status === 'completed' ? 'var(--success)' : 'var(--error)'} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '2px' }}>
                                                Auto-Save
                                            </p>
                                            <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                                {new Date(entry.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--success)' }}>
                                            +${entry.amount.toFixed(2)}
                                        </p>

                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
            <FeatureExplainerModal />
        </div>
    );
}
