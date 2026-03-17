import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import ChainSelector from '../../components/ChainSelector';
import { getBillers, type BillCategory } from '../../api/bills';
import { fetchRate as fetchCachedRate } from '../../utils/rateCache';
import { useChain } from '../../context/ChainContext';
import { NETWORK_LOGOS, detectNetwork } from '../../utils/networkUtils';

const NETWORKS = [
    { name: 'MTN', color: '#FFCB05', billerCode: 'BIL108' },
    { name: 'GLO', color: '#50B748', billerCode: 'BIL109' },
    { name: 'Airtel', color: '#ED1C24', billerCode: 'BIL110' },
    { name: '9mobile', color: '#006848', billerCode: 'BIL111' },
];

export default function BuyData() {
    const navigate = useNavigate();
    const { selectedChain } = useChain();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
    const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
    const [dataPlans, setDataPlans] = useState<BillCategory[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<BillCategory | null>(null);
    const [exchangeRate, setExchangeRate] = useState(1460);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);

    // Auto-detect network from phone number prefix
    useEffect(() => {
        const detected = detectNetwork(phoneNumber);
        if (detected) {
            setSelectedNetwork(detected);
        }
    }, [phoneNumber]);

    // Fetch exchange rate
    useEffect(() => {
        fetchCachedRate().then(rate => {
            if (rate > 0) setExchangeRate(rate);
        }).catch(err => console.error('Failed to fetch rate:', err));
    }, []);

    // Fetch data plans when network changes
    useEffect(() => {
        if (!selectedNetwork) return;

        const fetchPlans = async () => {
            setIsLoadingPlans(true);
            setDataPlans([]);
            setSelectedPlan(null);
            try {
                const network = NETWORKS.find(n => n.name === selectedNetwork);
                if (!network) return;

                const response = await getBillers('MOBILEDATA');
                const plans = response.data.filter(p => p.biller_code === network.billerCode);
                setDataPlans(plans);
            } catch (err) {
                console.error('Failed to fetch data plans:', err);
                setError('Failed to load data plans. Please try again.');
            } finally {
                setIsLoadingPlans(false);
            }
        };
        fetchPlans();
    }, [selectedNetwork]);

    const handleContinue = () => {
        setError(null);

        if (!phoneNumber || phoneNumber.length < 11) {
            setError('Please enter a valid 11-digit phone number');
            return;
        }
        if (!selectedNetwork) {
            setError('Please select a network');
            return;
        }
        if (!selectedPlan) {
            setError('Please select a data plan');
            return;
        }

        const amountNgn = selectedPlan.amount;
        const usdcAmount = amountNgn / exchangeRate;

        const coin = {
            sui: selectedChain === 'SUI',
            base: selectedChain === 'BASE',
            solana: selectedChain === 'SOLANA',
            ethereum: false,
            aptos: selectedChain === 'APTOS',
            bsc: selectedChain === 'BSC',
        };

        navigate('/bills/confirm', {
            state: {
                billType: 'MOBILEDATA',
                network: selectedNetwork,
                customerId: phoneNumber,
                customerLabel: 'Mobile Number',
                amountNgn,
                amountUsdc: usdcAmount,
                rate: exchangeRate,
                itemCode: selectedPlan.item_code,
                billerCode: selectedPlan.biller_code,
                billerType: selectedPlan.biller_name,
                itemName: formatPlanName(selectedNetwork, selectedPlan.name || selectedPlan.short_name),
                coin,
            }
        });
    };

    // Helper to ensure correct plan name format for Flutterwave
    const formatPlanName = (network: string, planName: string) => {
        if (!planName) return '';
        // MTN Data bundles strictly require "DATA BUNDLE" suffix in the Type field
        if (network === 'MTN' && !planName.toUpperCase().includes('DATA BUNDLE')) {
            return `${planName} DATA BUNDLE`;
        }
        return planName;
    };

    const currentNetwork = NETWORKS.find(n => n.name === selectedNetwork);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header with Chain Selector */}
            <div style={{ padding: '0 20px' }}>
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 0',
                    marginBottom: '20px',
                    position: 'relative',
                    justifyContent: 'space-between'
                }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'var(--nav-bg)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            flexShrink: 0,
                            position: 'relative',
                            zIndex: 1
                        }}
                    >
                        <ArrowLeft size={24} color="var(--text-main)" />
                    </button>
                    <h1 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        margin: 0,
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        color: 'var(--text-main)',
                    }}>
                        Buy data
                    </h1>
                    <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <ChainSelector />
                    </div>
                </header>
            </div>

            <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
                {/* Recipient's Details Card */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '20px',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: 'var(--card-shadow)',
                    transition: 'background-color 0.3s ease',
                }}>
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        marginBottom: '16px',
                    }}>
                        Recipient's details
                    </p>

                    {/* Phone Number Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--input-bg)',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '12px',
                        transition: 'all 0.3s ease',
                    }}>
                        <input
                            type="tel"
                            placeholder="Enter phone number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: 'none',
                                fontSize: '11px',
                                color: 'var(--text-main)',
                                outline: 'none',
                            }}
                        />
                        <ChevronDown size={18} color="var(--text-secondary)" />
                    </div>

                    {/* Network Selector Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'var(--input-bg)',
                                borderRadius: '14px',
                                padding: '14px 16px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                color: 'var(--text-main)',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}
                        >
                            {currentNetwork ? (
                                <>
                                    <img
                                        src={NETWORK_LOGOS[currentNetwork.name]}
                                        alt={currentNetwork.name}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'contain' }}
                                    />
                                    <span style={{ flex: 1, textAlign: 'left' }}>{currentNetwork.name}</span>
                                </>
                            ) : (
                                <span style={{ flex: 1, textAlign: 'left', color: 'var(--text-muted)' }}>Select network</span>
                            )}
                            <ChevronDown
                                size={18}
                                color="var(--text-secondary)"
                                style={{
                                    transform: showNetworkDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                }}
                            />
                        </button>

                        {showNetworkDropdown && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'var(--surface)',
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                marginTop: '4px',
                                zIndex: 10,
                                overflow: 'hidden',
                            }}>
                                {NETWORKS.map(network => (
                                    <button
                                        key={network.name}
                                        onClick={() => {
                                            setSelectedNetwork(network.name);
                                            setShowNetworkDropdown(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '12px 16px',
                                            border: 'none',
                                            background: selectedNetwork === network.name ? 'var(--primary-bg)' : 'transparent',
                                            cursor: 'pointer',
                                            color: 'var(--text-main)',
                                            fontSize: '11px',
                                            transition: 'background 0.15s ease',
                                        }}
                                    >
                                        <img
                                            src={NETWORK_LOGOS[network.name]}
                                            alt={network.name}
                                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'contain' }}
                                        />
                                        <span style={{ fontWeight: 500 }}>{network.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Plans Section */}
                {selectedNetwork && (
                    <div style={{
                        background: 'var(--surface)',
                        borderRadius: '20px',
                        padding: '24px',
                        marginBottom: '24px',
                        boxShadow: 'var(--card-shadow)',
                        transition: 'background-color 0.3s ease',
                    }}>
                        {isLoadingPlans ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        background: 'var(--input-bg)',
                                        borderRadius: '14px',
                                        padding: '16px',
                                        animation: 'pulse 1.5s infinite',
                                        height: '80px',
                                    }} />
                                ))}
                            </div>
                        ) : dataPlans.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>
                                No data plans available for {selectedNetwork}
                            </p>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                                gap: '10px',
                            }}>
                                {dataPlans.map((plan, index) => {
                                    const isSelected = selectedPlan?.item_code === plan.item_code;
                                    return (
                                        <button
                                            key={plan.item_code || index}
                                            onClick={() => setSelectedPlan(plan)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '14px 8px',
                                                borderRadius: '14px',
                                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: isSelected ? 'rgba(139, 92, 246, 0.06)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                color: 'var(--text-main)',
                                            }}
                                        >
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: '10px',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                            }}>
                                                {plan.short_name || plan.name}
                                            </span>
                                            <span style={{
                                                fontWeight: 600,
                                                fontSize: '9px',
                                                color: 'var(--text-main)',
                                            }}>
                                                ₦{plan.amount.toLocaleString()}
                                            </span>
                                            <span style={{
                                                fontSize: '9px',
                                                color: 'var(--text-muted)',
                                            }}>
                                                (≈${(plan.amount / exchangeRate).toFixed(2)} USDC)
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div style={{ marginBottom: '16px' }}>
                        <InlineError message={error} onDismiss={() => setError(null)} />
                    </div>
                )}

                {/* Confirm Button */}
                <div style={{ marginTop: 'auto', paddingBottom: '24px' }}>
                    <Button fullWidth onClick={handleContinue} disabled={!selectedPlan}>
                        Confirm Amount
                    </Button>
                </div>
            </div>
        </div>
    );
}
