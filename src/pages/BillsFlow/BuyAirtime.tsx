import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import ChainSelector from '../../components/ChainSelector';
import { useChain } from '../../context/ChainContext';
import { fetchRate as fetchCachedRate } from '../../utils/rateCache';
import { NETWORK_LOGOS, detectNetwork } from '../../utils/networkUtils';

// Nigerian network operators
const NETWORKS = [
    { name: 'MTN', color: '#FFCB05', billerCode: 'BIL099' },
    { name: 'GLO', color: '#50B748', billerCode: 'BIL102' },
    { name: 'Airtel', color: '#ED1C24', billerCode: 'BIL100' },
    { name: '9mobile', color: '#006848', billerCode: 'BIL103' },
];

// Quick amount chips in NGN
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000, 8000, 10000];

export default function BuyAirtime() {
    const navigate = useNavigate();
    const { selectedChain } = useChain();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
    const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
    const [amount, setAmount] = useState('');
    const [exchangeRate, setExchangeRate] = useState(1460);
    const [error, setError] = useState<string | null>(null);

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

    const handleContinue = () => {
        setError(null);
        const numAmount = parseFloat(amount) || 0;

        if (!phoneNumber || phoneNumber.length < 11) {
            setError('Please enter a valid 11-digit phone number');
            return;
        }
        if (!selectedNetwork) {
            setError('Please select a network');
            return;
        }
        if (numAmount < 50) {
            setError('Minimum airtime amount is ₦50');
            return;
        }
        if (numAmount > 50000) {
            setError('Maximum airtime amount is ₦50,000');
            return;
        }

        const network = NETWORKS.find(n => n.name === selectedNetwork);
        const usdcAmount = numAmount / exchangeRate;

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
                billType: 'AIRTIME',
                network: selectedNetwork,
                customerId: phoneNumber,
                customerLabel: 'Mobile Number',
                amountNgn: numAmount,
                amountUsdc: usdcAmount,
                rate: exchangeRate,
                itemCode: network?.billerCode || '',
                billerCode: network?.billerCode || '',
                billerType: 'AIRTIME',
                itemName: `${selectedNetwork} Airtime ₦${numAmount.toLocaleString()}`,
                coin,
            }
        });
    };

    const currentNetwork = NETWORKS.find(n => n.name === selectedNetwork);
    const numAmount = parseFloat(amount) || 0;

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
                        Buy airtime
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

                        {/* Dropdown */}
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

                {/* Amount Section */}
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '20px',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: 'var(--card-shadow)',
                    transition: 'background-color 0.3s ease',
                }}>
                    <p style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                    }}>
                        Amount
                    </p>

                    {/* Amount Display */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginBottom: '20px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={amount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^\d]/g, '');
                                    setAmount(val);
                                }}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    fontSize: '25px',
                                    fontWeight: 700,
                                    color: 'var(--text-main)',
                                    outline: 'none',
                                    width: '100%',
                                }}
                            />
                        </div>
                        {numAmount > 0 && (
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                            }}>
                                ≈ {(numAmount / exchangeRate).toFixed(2)} USDC
                            </span>
                        )}
                    </div>

                    {/* Quick Amount Chips */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                    }}>
                        {QUICK_AMOUNTS.map(a => (
                            <button
                                key={a}
                                onClick={() => setAmount(a.toString())}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: amount === a.toString()
                                        ? '2px solid var(--primary)'
                                        : '1px solid var(--border-color)',
                                    background: amount === a.toString() ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                                    color: amount === a.toString() ? 'var(--primary)' : 'var(--text-main)',
                                    fontWeight: 500,
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                ₦{a.toLocaleString()}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div style={{ marginBottom: '16px' }}>
                        <InlineError message={error} onDismiss={() => setError(null)} />
                    </div>
                )}

                {/* Confirm Button — pinned to bottom */}
                <div style={{ marginTop: 'auto', paddingBottom: '24px' }}>
                    <Button fullWidth onClick={handleContinue}>
                        Confirm Amount
                    </Button>
                </div>
            </div>
        </div>
    );
}
