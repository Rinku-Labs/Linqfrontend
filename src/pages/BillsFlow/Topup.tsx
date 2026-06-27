import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Phone, Wifi, Zap, Tv, CheckCircle2, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import ChainSelector from '../../components/ChainSelector';
import { getBillers, validateMeter, type BillCategory } from '../../api/bills';
import { useChain } from '../../context/ChainContext';
import { NETWORK_LOGOS, detectNetwork } from '../../utils/networkUtils';
import { getBillBeneficiaries, type BillBeneficiary } from '../../api/user';

// Nigerian network operators — airtime biller codes
const AIRTIME_NETWORKS = [
    { name: 'MTN', color: '#FFCB05', billerCode: 'BIL099' },
    { name: 'GLO', color: '#50B748', billerCode: 'BIL102' },
    { name: 'Airtel', color: '#ED1C24', billerCode: 'BIL100' },
    { name: '9mobile', color: '#006848', billerCode: 'BIL103' },
];

// Data biller codes
const DATA_NETWORKS = [
    { name: 'MTN', color: '#FFCB05', billerCode: 'BIL108' },
    { name: 'GLO', color: '#50B748', billerCode: 'BIL109' },
    { name: 'Airtel', color: '#ED1C24', billerCode: 'BIL110' },
    { name: '9mobile', color: '#006848', billerCode: 'BIL111' },
];

// Quick amount chips for airtime in NGN
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000, 8000, 10000];

type TopupTab = 'airtime' | 'data' | 'electricity' | 'tv';

// Extract data size label from plan name (e.g., "500MB", "1.5GB")
function parseDataSize(plan: { name: string; short_name: string }): string {
    const text = `${plan.short_name} ${plan.name}`;
    const match = text.match(/(\d+\.?\d*)\s*(MB|GB|TB)/i);
    if (match) return `${match[1]}${match[2].toUpperCase()}`;
    return plan.short_name || plan.name;
}

// Helper function to categorize raw durations into Daily, Weekly, Monthly
function categorizeDuration(plan: { name: string; short_name: string }): string {
    const text = `${plan.short_name} ${plan.name}`.toLowerCase().replace(/\s+/g, '');

    if (text.includes('month') || text.includes('30day') || text.includes('60day') || text.includes('90day')) return 'Monthly';
    if (text.includes('week')) return 'Weekly';
    if (text.includes('year') || text.includes('365day')) return 'Yearly';
    if (text.includes('hour') || text.includes('hr') || text.includes('night') || text.includes('mid')) return 'Daily';

    const match = text.match(/(\d+)day/);
    if (match) {
        const days = parseInt(match[1], 10);
        if (days >= 1 && days <= 6) return 'Daily';
        if (days >= 7 && days <= 29) return 'Weekly';
        if (days >= 30) return 'Monthly';
    }

    if (text.includes('daily') || text.includes('day')) return 'Daily';

    return 'Other';
}

export default function Topup() {
    const navigate = useNavigate();
    const { selectedChain } = useChain();
    const [searchParams] = useSearchParams();

    // Active tab
    const [activeTab, setActiveTab] = useState<TopupTab>((searchParams.get('tab') as TopupTab) || 'airtime');

    // Shared state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
    const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
    const [exchangeRate, setExchangeRate] = useState(1460);
    const [error, setError] = useState<string | null>(null);

    // Airtime-specific state
    const [amount, setAmount] = useState('');

    // Data-specific state
    const [dataPlans, setDataPlans] = useState<BillCategory[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<BillCategory | null>(null);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [activeDataDuration, setActiveDataDuration] = useState<string>('');

    // Electricity-specific state
    const [electricityBillers, setElectricityBillers] = useState<BillCategory[]>([]);
    const [electricityCompany, setElectricityCompany] = useState<string | null>(null);
    const [electricityPlanType, setElectricityPlanType] = useState<BillCategory | null>(null);
    const [meterType, setMeterType] = useState<string | null>(null);
    const [showElectricityDropdown, setShowElectricityDropdown] = useState(false);
    const [showPlanDropdown, setShowPlanDropdown] = useState(false);
    const [meterNumber, setMeterNumber] = useState('');
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [electricityAmount, setElectricityAmount] = useState('');
    const [isLoadingElectricity, setIsLoadingElectricity] = useState(false);

    // TV-specific state
    const [tvBillers, setTvBillers] = useState<BillCategory[]>([]);
    const [tvProvider, setTvProvider] = useState<string | null>(null);
    const [tvBouquet, setTvBouquet] = useState<BillCategory | null>(null);
    const [showTvProviderDropdown, setShowTvProviderDropdown] = useState(false);
    const [showTvBouquetDropdown, setShowTvBouquetDropdown] = useState(false);
    const [smartcardNumber, setSmartcardNumber] = useState('');
    const [tvVerifiedName, setTvVerifiedName] = useState<string | null>(null);
    const [isTvVerifying, setIsTvVerifying] = useState(false);
    const [isLoadingTv, setIsLoadingTv] = useState(false);

    // Beneficiaries State
    const [airtimeBeneficiaries, setAirtimeBeneficiaries] = useState<BillBeneficiary[]>([]);
    const [dataBeneficiaries, setDataBeneficiaries] = useState<BillBeneficiary[]>([]);
    const [tvBeneficiaries, setTvBeneficiaries] = useState<BillBeneficiary[]>([]);
    const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

    useEffect(() => {
        getBillBeneficiaries()
            .then(res => {
                const data = res.data || [];
                setAirtimeBeneficiaries(data.filter(b => b.billType === 'AIRTIME'));
                setDataBeneficiaries(data.filter(b => b.billType === 'MOBILEDATA'));
                setTvBeneficiaries(data.filter(b => b.billType === 'CABLETV'));
            })
            .catch(err => console.error('Failed to load bill beneficiaries', err));
    }, []);

    // Helper to get a clean base name for grouping (removing Prepaid, Postpaid, Topup etc)
    const getCleanedCompanyName = (b: BillCategory) => {
        const rawName = b.biller_name || b.name || b.short_name || '';
        return rawName
            .replace(/prepaid|postpaid|topup|disco|electric|electricity|payment|bill|services/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    };

    // Get unique electricity companies
    const getUniqueCompanies = () => {
        const unique = new Set<string>();
        electricityBillers.forEach(b => {
            unique.add(getCleanedCompanyName(b));
        });
        return Array.from(unique).sort();
    };

    // Get unique TV providers (DSTV, GOTV, Startimes)
    const getTvProviders = () => {
        const providers = new Map<string, string>();
        tvBillers.forEach(b => {
            const name = (b.biller_name || b.name || '').toUpperCase();
            if (name.includes('DSTV')) providers.set('DSTV', 'DSTV');
            else if (name.includes('GOTV')) providers.set('GOTV', 'GOTV');
            else if (name.includes('STARTIMES')) providers.set('STARTIMES', 'STARTIMES');
            else {
                const cleaned = getCleanedCompanyName(b);
                if (cleaned) providers.set(cleaned, cleaned);
            }
        });
        return Array.from(providers.values()).sort();
    };

    // Smartcard/IUC length rules per provider. DStv IUC numbers are 10-11 digits,
    // GOtv is 10, StarTimes is 11. Showmax is account/voucher based (be permissive).
    const SMARTCARD_RULES: Record<string, { min: number; max: number }> = {
        DSTV: { min: 10, max: 11 },
        GOTV: { min: 10, max: 10 },
        STARTIMES: { min: 11, max: 11 },
        SHOWMAX: { min: 6, max: 20 },
    };
    const getSmartcardRule = (provider: string | null) =>
        (provider && SMARTCARD_RULES[provider.toUpperCase()]) || { min: 10, max: 11 };
    const isSmartcardValid = (provider: string | null, value: string) => {
        const rule = getSmartcardRule(provider);
        return value.length >= rule.min && value.length <= rule.max;
    };

    // Showmax has no decoder/smartcard and Nomba's lookup doesn't support it, so
    // it skips the verify step and collects an account/phone identifier instead.
    const isShowmax = (tvProvider || '').toUpperCase() === 'SHOWMAX';

    // Get bouquets/packages for selected TV provider
    const tvBouquets = tvBillers.filter(b => {
        if (!tvProvider) return false;
        const name = (b.biller_name || b.name || '').toUpperCase();
        return name.includes(tvProvider);
    }).sort((a, b) => a.amount - b.amount);


    // Sort data plans by amount ascending
    const sortedDataPlans = [...dataPlans].sort((a, b) => a.amount - b.amount);

    // Group data plans by duration category
    const groupedDataPlans = sortedDataPlans.reduce((groups, plan) => {
        const key = categorizeDuration(plan);
        if (!groups[key]) groups[key] = [];
        groups[key].push(plan);
        return groups;
    }, {} as Record<string, BillCategory[]>);

    const dataDurations = Object.keys(groupedDataPlans).sort((a, b) => {
        const order = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        const aIdx = order.indexOf(a);
        const bIdx = order.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
    });

    const activePlans = activeDataDuration && groupedDataPlans[activeDataDuration]
        ? groupedDataPlans[activeDataDuration]
        : sortedDataPlans;

    // Auto-detect network from phone number prefix
    useEffect(() => {
        const detected = detectNetwork(phoneNumber);
        if (detected) {
            setSelectedNetwork(detected);
        }
    }, [phoneNumber]);

    // Fetch exchange rate
    useEffect(() => {
        const loadRate = async () => {
            try {
                const { fetchRate: fetchCachedRate } = await import('../../utils/rateCache');
                const rate = await fetchCachedRate();
                if (rate > 0) setExchangeRate(rate);
            } catch (_err) {
                // silently fail
            }
        };
        loadRate();
    }, []);

    // Fetch data plans when network changes and data tab is active
    useEffect(() => {
        if (activeTab !== 'data' || !selectedNetwork) return;

        const fetchPlans = async () => {
            setIsLoadingPlans(true);
            setDataPlans([]);
            setSelectedPlan(null);
            try {
                const network = DATA_NETWORKS.find(n => n.name === selectedNetwork);
                if (!network) return;

                const response = await getBillers('MOBILEDATA');
                const plans = response.data.filter((p: any) => p.biller_code === network.billerCode);
                setDataPlans(plans);

                // Auto-select first duration category
                if (plans.length > 0) {
                    const durations = Array.from(new Set(plans.map((p: any) => categorizeDuration(p))));
                    if (durations.includes('Daily')) setActiveDataDuration('Daily');
                    else if (durations.includes('Monthly')) setActiveDataDuration('Monthly');
                    else setActiveDataDuration(durations[0] as string);
                }
            } catch (_err) {
                setError('Failed to load data plans. Please try again.');
            } finally {
                setIsLoadingPlans(false);
            }
        };
        fetchPlans();
    }, [selectedNetwork, activeTab]);

    // Fetch electricity billers
    useEffect(() => {
        if (activeTab !== 'electricity') return;

        const fetchElectricity = async () => {
            setIsLoadingElectricity(true);
            try {
                const response = await getBillers('ELECTRICITY');
                setElectricityBillers(response.data || []);
            } catch (_err) {
                setError('Failed to load electricity providers.');
            } finally {
                setIsLoadingElectricity(false);
            }
        };
        fetchElectricity();
    }, [activeTab]);

    // Fetch TV billers
    useEffect(() => {
        if (activeTab !== 'tv') return;

        const fetchTv = async () => {
            setIsLoadingTv(true);
            try {
                const response = await getBillers('CABLETV');
                setTvBillers(response.data || []);
            } catch (_err) {
                setError('Failed to load TV providers.');
            } finally {
                setIsLoadingTv(false);
            }
        };
        fetchTv();
    }, [activeTab]);

    // Meter Verification
    const handleVerifyMeter = useCallback(async () => {
        if (!meterNumber || meterNumber.length < 7 || !electricityPlanType) return;

        setIsVerifying(true);
        setError(null);
        setVerifiedName(null);
        try {
            const resp = await validateMeter(
                electricityPlanType.item_code,
                electricityPlanType.biller_code,
                meterNumber,
                'ELECTRICITY'
            );

            if (resp && resp.data && resp.data.name) {
                setVerifiedName(resp.data.name);
            } else if (resp && resp.data && resp.data.customer) {
                setVerifiedName(resp.data.customer);
            } else {
                setError('Could not verify meter number. Please check the number.');
            }
        } catch (_err: any) {
            setError(_err.response?.data?.message || 'Meter verification failed. Invalid meter or service downtime.');
        } finally {
            setIsVerifying(false);
        }
    }, [meterNumber, electricityPlanType]);

    // Smartcard Verification (TV)
    const handleVerifySmartcard = useCallback(async () => {
        if (!smartcardNumber || !tvBouquet || !isSmartcardValid(tvProvider, smartcardNumber)) return;

        setIsTvVerifying(true);
        setError(null);
        setTvVerifiedName(null);
        try {
            const resp = await validateMeter(
                tvBouquet.item_code,
                tvBouquet.biller_code,
                smartcardNumber,
                'CABLETV'
            );

            if (resp && resp.data && resp.data.name) {
                setTvVerifiedName(resp.data.name);
            } else if (resp && resp.data && resp.data.customer) {
                setTvVerifiedName(resp.data.customer);
            } else {
                setError('Could not verify smartcard number. Please check the number.');
            }
        } catch (_err: any) {
            setError(_err.response?.data?.message || 'Smartcard verification failed. Invalid number or service downtime.');
        } finally {
            setIsTvVerifying(false);
        }
    }, [smartcardNumber, tvBouquet, tvProvider]);

    // Build coin object
    const buildCoin = () => ({
        sui: selectedChain === 'SUI',
        base: selectedChain === 'BASE',
        solana: selectedChain === 'SOLANA',
        ethereum: false,
        aptos: selectedChain === 'APTOS',
        bsc: selectedChain === 'BSC',
    });

    // Handle airtime confirm
    const handleAirtimeContinue = () => {
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

        const network = AIRTIME_NETWORKS.find(n => n.name === selectedNetwork);
        const usdcAmount = numAmount / exchangeRate;

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
                coin: buildCoin(),
            }
        });
    };

    // Handle data confirm
    const handleDataContinue = () => {
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
                billerType: selectedPlan.name,
                itemName: selectedPlan.name || selectedPlan.short_name,
                coin: buildCoin(),
            }
        });
    };

    // Handle Electricity Confirm
    const handleElectricityContinue = () => {
        setError(null);
        const numAmount = parseFloat(electricityAmount) || 0;

        if (!electricityCompany) {
            setError('Please select an Electricity provider');
            return;
        }
        if (!electricityPlanType) {
            setError('Please select an Electricity provider');
            return;
        }
        if (!meterType) {
            setError('Please select a meter type (Prepaid/Postpaid)');
            return;
        }
        if (!verifiedName) {
            setError('Please verify meter number first');
            return;
        }
        if (numAmount < 1000) {
            setError('Minimum electricity amount is ₦1,000');
            return;
        }

        const usdcAmount = numAmount / exchangeRate;

        navigate('/bills/confirm', {
            state: {
                billType: 'ELECTRICITY',
                network: electricityCompany,
                customerId: meterNumber,
                customerLabel: 'Meter Number',
                amountNgn: numAmount,
                amountUsdc: usdcAmount,
                rate: exchangeRate,
                itemCode: electricityPlanType.item_code,
                billerCode: electricityPlanType.biller_code,
                billerType: electricityPlanType.name || electricityPlanType.short_name,
                meterType: meterType.toUpperCase(), // Nomba expects PREPAID / POSTPAID
                itemName: `${electricityPlanType.name || electricityPlanType.biller_name} — ${meterType} (₦${numAmount.toLocaleString()})`,
                coin: buildCoin(),
                verifiedName: verifiedName,
            }
        });
    }

    // Handle TV Confirm
    const handleTvContinue = () => {
        setError(null);

        if (!tvProvider) {
            setError('Please select a TV provider');
            return;
        }
        if (!tvBouquet) {
            setError('Please select a bouquet/package');
            return;
        }
        // Showmax has no smartcard to verify; require a valid account/phone instead.
        if (isShowmax) {
            if (!isSmartcardValid(tvProvider, smartcardNumber)) {
                setError('Please enter your Showmax account / phone number');
                return;
            }
        } else if (!tvVerifiedName) {
            setError('Please verify your smartcard number first');
            return;
        }

        const amountNgn = tvBouquet.amount;
        const usdcAmount = amountNgn / exchangeRate;

        navigate('/bills/confirm', {
            state: {
                billType: 'CABLETV',
                network: tvProvider,
                customerId: smartcardNumber,
                customerLabel: isShowmax ? 'Showmax Account' : 'Smartcard/IUC Number',
                amountNgn,
                amountUsdc: usdcAmount,
                rate: exchangeRate,
                itemCode: tvBouquet.item_code,
                billerCode: tvBouquet.biller_code,
                billerType: tvBouquet.name || tvBouquet.short_name,
                itemName: `${tvProvider} - ${tvBouquet.name || tvBouquet.short_name}`,
                coin: buildCoin(),
                verifiedName: tvVerifiedName,
            }
        });
    };

    const networks = activeTab === 'airtime' ? AIRTIME_NETWORKS : DATA_NETWORKS;
    const currentNetwork = networks.find(n => n.name === selectedNetwork);
    const numAmount = activeTab === 'electricity' ? (parseFloat(electricityAmount) || 0) : activeTab === 'tv' ? (tvBouquet?.amount || 0) : (parseFloat(amount) || 0);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '0 20px' }}>
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 0',
                    marginBottom: '8px',
                    position: 'relative',
                    justifyContent: 'space-between',
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
                        Bills
                    </h1>
                    <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <ChainSelector />
                    </div>
                </header>

                {/* Airtime / Data / Electricity Toggle Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'var(--input-bg)',
                    borderRadius: '14px',
                    padding: '4px',
                    marginBottom: '20px',
                    border: '1px solid var(--border-color)',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}>
                    <button
                        onClick={() => { setActiveTab('airtime'); setError(null); }}
                        style={{
                            flex: 1,
                            minWidth: '90px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 10px',
                            borderRadius: '11px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '9px',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            background: activeTab === 'airtime' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'airtime' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'airtime' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                        }}
                    >
                        <Phone size={14} />
                        Airtime
                    </button>
                    <button
                        onClick={() => { setActiveTab('data'); setError(null); }}
                        style={{
                            flex: 1,
                            minWidth: '90px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 10px',
                            borderRadius: '11px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '9px',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            background: activeTab === 'data' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'data' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'data' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                        }}
                    >
                        <Wifi size={14} />
                        Data
                    </button>
                    <button
                        onClick={() => { setActiveTab('electricity'); setError(null); }}
                        style={{
                            flex: 1,
                            minWidth: '90px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 10px',
                            borderRadius: '11px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '9px',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            background: activeTab === 'electricity' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'electricity' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'electricity' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                        }}
                    >
                        <Zap size={14} />
                        Electricity
                    </button>
                    <button
                        onClick={() => { setActiveTab('tv'); setError(null); }}
                        style={{
                            flex: 1,
                            minWidth: '70px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '12px 8px',
                            borderRadius: '11px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            background: activeTab === 'tv' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'tv' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'tv' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                        }}
                    >
                        <Tv size={14} />
                        TV
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
                {/* Recipient's Details Card (shared for Airtime & Data) */}
                {(activeTab === 'airtime' || activeTab === 'data') && (
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
                        <div style={{ position: 'relative' }}>
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
                                    onFocus={() => setShowPhoneDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '11px',
                                        color: 'var(--text-main)',
                                        outline: 'none',
                                    }}
                                />
                                {(activeTab === 'airtime' ? airtimeBeneficiaries : dataBeneficiaries).length > 0 && (
                                    <ChevronDown
                                        size={18}
                                        color="var(--text-secondary)"
                                        style={{ transform: showPhoneDropdown ? 'rotate(180deg)' : 'none', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                        onClick={() => setShowPhoneDropdown(!showPhoneDropdown)}
                                    />
                                )}
                            </div>

                            {/* Dropdown for Recent Numbers */}
                            {showPhoneDropdown && (activeTab === 'airtime' ? airtimeBeneficiaries : dataBeneficiaries).length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--surface)',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                    marginTop: '-8px',
                                    marginBottom: '12px',
                                    zIndex: 10,
                                    overflow: 'hidden',
                                }}>
                                    <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                                        Recent Numbers
                                    </div>
                                    {(activeTab === 'airtime' ? airtimeBeneficiaries : dataBeneficiaries).map((ben) => (
                                        <button
                                            key={ben.id}
                                            onClick={() => {
                                                setPhoneNumber(ben.customerId);
                                                if (ben.network) setSelectedNetwork(ben.network);
                                                setShowPhoneDropdown(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px 16px',
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                color: 'var(--text-main)',
                                                fontSize: '13px',
                                                transition: 'background 0.15s ease',
                                                borderBottom: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <span style={{ fontWeight: 600 }}>{ben.customerId}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--primary)' }}>{ben.network}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
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
                                    {networks.map(network => (
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
                )}

                {/* ===== ELECTRICITY CONTENT ===== */}
                {activeTab === 'electricity' && (
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
                            Meter details
                        </p>

                        {/* Select Company Dropdown */}
                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <button
                                onClick={() => setShowElectricityDropdown(!showElectricityDropdown)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    background: 'var(--input-bg)', borderRadius: '14px', padding: '14px 16px',
                                    border: '1px solid var(--border-color)', cursor: 'pointer',
                                    color: 'var(--text-main)', fontSize: '11px', fontWeight: 500,
                                }}
                            >
                                <span style={{ flex: 1, textAlign: 'left' }}>
                                    {electricityCompany || <span style={{ color: 'var(--text-muted)' }}>Select Company</span>}
                                </span>
                                <ChevronDown size={18} color="var(--text-secondary)" />
                            </button>

                            {showElectricityDropdown && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border-color)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: '4px', zIndex: 10,
                                    maxHeight: '200px', overflowY: 'auto',
                                }}>
                                    {isLoadingElectricity ? (
                                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                                    ) : getUniqueCompanies().map(comp => (
                                        <button
                                            key={comp}
                                            onClick={() => {
                                                setElectricityCompany(comp);
                                                // Nomba returns one disco entry per company; bind it as the
                                                // biller so verify/vend have the disco's code. Meter type
                                                // (prepaid/postpaid) is chosen separately below.
                                                const disco = electricityBillers.find(b => getCleanedCompanyName(b) === comp) || null;
                                                setElectricityPlanType(disco);
                                                setMeterType(null);
                                                setShowElectricityDropdown(false);
                                                setVerifiedName(null);
                                            }}
                                            style={{
                                                width: '100%', display: 'block', textAlign: 'left',
                                                padding: '12px 16px', border: 'none',
                                                background: electricityCompany === comp ? 'var(--primary-bg)' : 'transparent',
                                                cursor: 'pointer', color: 'var(--text-main)', fontSize: '11px',
                                            }}
                                        >
                                            <span style={{ fontWeight: 500 }}>{comp}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Select Plan Type (Prepaid/Postpaid) */}
                        {electricityCompany && (
                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                <button
                                    onClick={() => setShowPlanDropdown(!showPlanDropdown)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                        background: 'var(--input-bg)', borderRadius: '14px', padding: '14px 16px',
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        color: 'var(--primary)', fontSize: '11px', fontWeight: 600,
                                    }}
                                >
                                    <span style={{ flex: 1, textAlign: 'left' }}>
                                        {meterType || <span style={{ color: 'var(--primary)' }}>Select meter type</span>}
                                    </span>
                                    <ChevronDown size={18} color="var(--primary)" />
                                </button>
                                {showPlanDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border-color)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: '4px', zIndex: 10,
                                    }}>
                                        {['Prepaid', 'Postpaid'].map(mt => (
                                            <button
                                                key={mt}
                                                onClick={() => {
                                                    setMeterType(mt);
                                                    setShowPlanDropdown(false);
                                                    setVerifiedName(null);
                                                }}
                                                style={{
                                                    width: '100%', display: 'block', textAlign: 'left',
                                                    padding: '12px 16px', border: 'none',
                                                    background: meterType === mt ? 'var(--primary-bg)' : 'transparent',
                                                    cursor: 'pointer', color: 'var(--text-main)', fontSize: '11px',
                                                }}
                                            >
                                                <span style={{ fontWeight: 500 }}>{mt}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Meter Number Input */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--input-bg)',
                            borderRadius: '14px',
                            padding: '14px 16px',
                            border: verifiedName ? '1px solid var(--success)' : '1px solid var(--border-color)',
                            marginBottom: '12px',
                            transition: 'all 0.3s ease',
                        }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Meter Number (11+ digits)"
                                value={meterNumber}
                                onChange={(e) => {
                                    setMeterNumber(e.target.value.replace(/\D/g, ''));
                                    setVerifiedName(null);
                                }}
                                style={{
                                    flex: 1, border: 'none', background: 'none',
                                    fontSize: '11px', color: 'var(--text-main)', outline: 'none',
                                }}
                            />
                            {verifiedName ? (
                                <CheckCircle2 size={18} color="var(--success)" />
                            ) : null}
                        </div>

                        {/* Display verified name or Verify Button */}
                        {verifiedName ? (
                            <div style={{ padding: '8px 12px', background: 'var(--primary-bg)', borderRadius: '8px', marginBottom: '12px' }}>
                                <p style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 600 }}>
                                    Verified: {verifiedName}
                                </p>
                            </div>
                        ) : electricityPlanType && meterType && meterNumber.length >= 7 ? (
                            <div style={{ marginBottom: '12px' }}>
                                <Button
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleVerifyMeter}
                                    disabled={isVerifying}
                                >
                                    {isVerifying ? <Loader2 className="animate-spin" size={16} /> : 'Verify Meter'}
                                </Button>
                            </div>
                        ) : null}

                        {/* Amount Section (Locked until verified) */}
                        <div style={{ position: 'relative' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Amount {!verifiedName && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>(Verify meter first)</span>}
                            </p>
                            <div style={{
                                display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px',
                                opacity: verifiedName ? 1 : 0.4,
                                pointerEvents: verifiedName ? 'auto' : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                    <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)' }}>₦</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={electricityAmount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            setElectricityAmount(val);
                                        }}
                                        style={{
                                            border: 'none', background: 'none', fontSize: '25px',
                                            fontWeight: 700, color: 'var(--text-main)', outline: 'none',
                                            width: '100%',
                                        }}
                                    />
                                </div>
                                {numAmount > 0 && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                        ≈ {(numAmount / exchangeRate).toFixed(2)} USDC
                                    </span>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* ===== TV TAB CONTENT ===== */}
                {activeTab === 'tv' && (
                    <div style={{
                        background: 'var(--surface)',
                        borderRadius: '20px',
                        padding: '24px',
                        marginBottom: '24px',
                        boxShadow: 'var(--card-shadow)',
                        transition: 'background-color 0.3s ease',
                    }}>
                        <p style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            marginBottom: '16px',
                        }}>
                            Subscription details
                        </p>

                        {isLoadingTv ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        background: 'var(--input-bg)',
                                        borderRadius: '14px',
                                        padding: '16px',
                                        animation: 'pulse 1.5s infinite',
                                        height: '56px',
                                    }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                {/* Quick Renew Button */}
                                {tvBeneficiaries.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <button
                                            onClick={() => {
                                                const recent = tvBeneficiaries[0];
                                                setTvProvider(recent.network);
                                                setSmartcardNumber(recent.customerId);
                                                setTvVerifiedName(null);
                                                
                                                // Find the bouquet if possible
                                                const relatedBillers = tvBillers.filter(b => {
                                                    const name = (b.biller_name || b.name || '').toUpperCase();
                                                    return name.includes(recent.network);
                                                });
                                                const foundBouquet = relatedBillers.find(b => b.item_code === recent.itemCode) || null;
                                                setTvBouquet(foundBouquet);
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                border: '1px dashed var(--primary)',
                                                borderRadius: '14px',
                                                padding: '12px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Renew Previous Subscription</span>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                                                {tvBeneficiaries[0].network} - {tvBeneficiaries[0].itemName || 'Package'}
                                            </span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                IUC: {tvBeneficiaries[0].customerId}
                                            </span>
                                        </button>
                                    </div>
                                )}

                                {/* TV Provider Dropdown */}
                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                    <button
                                        onClick={() => { setShowTvProviderDropdown(!showTvProviderDropdown); setShowTvBouquetDropdown(false); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'var(--input-bg)',
                                            borderRadius: '14px',
                                            padding: '14px 16px',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            fontSize: '15px',
                                            color: tvProvider ? 'var(--text-main)' : 'var(--text-muted)',
                                            fontWeight: tvProvider ? 600 : 400,
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        <span>{tvProvider || 'Select Provider'}</span>
                                        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: showTvProviderDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                                    </button>
                                    {showTvProviderDropdown && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                                            background: 'var(--surface)', borderRadius: '14px',
                                            border: '1px solid var(--border-color)', marginTop: '4px',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: '200px', overflow: 'auto',
                                        }}>
                                            {getTvProviders().map(provider => (
                                                <button
                                                    key={provider}
                                                    onClick={() => {
                                                        setTvProvider(provider);
                                                        setTvBouquet(null);
                                                        setSmartcardNumber('');
                                                        setTvVerifiedName(null);
                                                        setShowTvProviderDropdown(false);
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '12px 16px',
                                                        background: tvProvider === provider ? 'rgba(139, 92, 246, 0.06)' : 'transparent',
                                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                                        fontSize: '14px', fontWeight: 500,
                                                        color: tvProvider === provider ? 'var(--primary)' : 'var(--text-main)',
                                                        borderBottom: '1px solid var(--border-color)',
                                                    }}
                                                >
                                                    {provider}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Smartcard Number Input (Moved before Bouquet) */}
                                {tvProvider && (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--input-bg)',
                                            borderRadius: '14px',
                                            padding: '14px 16px',
                                            border: tvVerifiedName ? '1px solid var(--success)' : '1px solid var(--border-color)',
                                            marginBottom: '12px',
                                            transition: 'all 0.3s ease',
                                        }}>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={getSmartcardRule(tvProvider).max}
                                                placeholder={(() => {
                                                    if (isShowmax) return 'Showmax account / phone number';
                                                    const rule = getSmartcardRule(tvProvider);
                                                    const range = rule.min === rule.max ? `${rule.min}` : `${rule.min}-${rule.max}`;
                                                    return `Smartcard/IUC Number (${range} digits)`;
                                                })()}
                                                value={smartcardNumber}
                                                onChange={(e) => {
                                                    const rule = getSmartcardRule(tvProvider);
                                                    setSmartcardNumber(e.target.value.replace(/\D/g, '').slice(0, rule.max));
                                                    setTvVerifiedName(null);
                                                }}
                                                style={{
                                                    flex: 1, border: 'none', background: 'none',
                                                    fontSize: '15px', color: 'var(--text-main)', outline: 'none',
                                                }}
                                            />
                                            {tvVerifiedName ? (
                                                <CheckCircle2 size={18} color="var(--success)" />
                                            ) : null}
                                        </div>
                                    </div>
                                )}

                                {/* Bouquet / Package Dropdown */}
                                {tvProvider && isSmartcardValid(tvProvider, smartcardNumber) && (
                                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                                        <button
                                            onClick={() => { setShowTvBouquetDropdown(!showTvBouquetDropdown); setShowTvProviderDropdown(false); }}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: 'var(--input-bg)',
                                                borderRadius: '14px',
                                                padding: '14px 16px',
                                                border: '1px solid var(--border-color)',
                                                cursor: 'pointer',
                                                fontSize: '15px',
                                                color: tvBouquet ? 'var(--text-main)' : 'var(--text-muted)',
                                                fontWeight: tvBouquet ? 600 : 400,
                                                transition: 'all 0.3s ease',
                                            }}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                                {tvBouquet ? `${tvBouquet.name || tvBouquet.short_name} — ₦${tvBouquet.amount.toLocaleString()}` : 'Select Bouquet'}
                                            </span>
                                            <ChevronDown size={18} color="var(--text-muted)" style={{ transform: showTvBouquetDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                                        </button>
                                        {showTvBouquetDropdown && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                                                background: 'var(--surface)', borderRadius: '14px',
                                                border: '1px solid var(--border-color)', marginTop: '4px',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: '250px', overflow: 'auto',
                                            }}>
                                                {tvBouquets.length === 0 ? (
                                                    <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>No packages found</p>
                                                ) : tvBouquets.map((b, idx) => (
                                                    <button
                                                        key={b.item_code || idx}
                                                        onClick={() => {
                                                            // Do NOT clear the smartcard number here — selecting a
                                                            // bouquet must keep what the user already entered.
                                                            setTvBouquet(b);
                                                            setShowTvBouquetDropdown(false);
                                                        }}
                                                        style={{
                                                            width: '100%', padding: '12px 16px',
                                                            background: tvBouquet?.item_code === b.item_code ? 'rgba(139, 92, 246, 0.06)' : 'transparent',
                                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                                            fontSize: '14px', fontWeight: 500,
                                                            color: tvBouquet?.item_code === b.item_code ? 'var(--primary)' : 'var(--text-main)',
                                                            borderBottom: '1px solid var(--border-color)',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        }}
                                                    >
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                                            {b.name || b.short_name}
                                                        </span>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }}>
                                                            ₦{b.amount.toLocaleString()}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Verified name or Verify Button (Showmax has no smartcard to verify) */}
                                {isShowmax ? null : tvVerifiedName ? (
                                    <div style={{ padding: '8px 12px', background: 'var(--primary-bg)', borderRadius: '8px', marginBottom: '12px' }}>
                                        <p style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                                            Verified: {tvVerifiedName}
                                        </p>
                                    </div>
                                ) : tvBouquet && isSmartcardValid(tvProvider, smartcardNumber) ? (
                                    <div style={{ marginBottom: '12px' }}>
                                        <Button
                                            variant="secondary"
                                            fullWidth
                                            onClick={handleVerifySmartcard}
                                            disabled={isTvVerifying}
                                        >
                                            {isTvVerifying ? <Loader2 className="animate-spin" size={16} /> : 'Verify Smartcard'}
                                        </Button>
                                    </div>
                                ) : null}

                                {/* Amount display (fixed from bouquet) */}
                                {tvBouquet && (isShowmax || tvVerifiedName) && (
                                    <div style={{
                                        background: 'var(--input-bg)',
                                        borderRadius: '14px',
                                        padding: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}>
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Amount</p>
                                            <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>₦{tvBouquet.amount.toLocaleString()}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>USDC</p>
                                            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)' }}>
                                                {(tvBouquet.amount / exchangeRate).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ===== AIRTIME TAB CONTENT ===== */}
                {activeTab === 'airtime' && (
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
                )}

                {/* ===== DATA TAB CONTENT ===== */}
                {activeTab === 'data' && selectedNetwork && (
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
                            <>
                                {/* Duration category tabs */}
                                {dataDurations.length > 1 && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginBottom: '16px',
                                        overflowX: 'auto',
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                    }}>
                                        {dataDurations.map(duration => {
                                            const isActive = activeDataDuration === duration;
                                            const count = groupedDataPlans[duration]?.length || 0;
                                            return (
                                                <button
                                                    key={duration}
                                                    onClick={() => {
                                                        setActiveDataDuration(duration);
                                                        setSelectedPlan(null);
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        border: 'none',
                                                        background: isActive ? 'var(--primary)' : 'var(--input-bg)',
                                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: isActive ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                                                    }}
                                                >
                                                    {duration} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Data plan cards */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                                    gap: '10px',
                                }}>
                                    {activePlans.map((plan, index) => {
                                        const isSelected = selectedPlan?.item_code === plan.item_code;
                                        const dataSize = parseDataSize(plan);
                                        return (
                                            <button
                                                key={plan.item_code || index}
                                                onClick={() => setSelectedPlan(plan)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '14px 6px',
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
                                                    color: 'var(--primary)',
                                                }}>
                                                    {dataSize}
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
                                                    (≈{(plan.amount / exchangeRate).toFixed(2)} USDC)
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {error && (
                    <div style={{ marginBottom: '16px' }}>
                        <InlineError message={error} onDismiss={() => setError(null)} />
                    </div>
                )}

                {/* Confirm Button — pinned to bottom */}
                <div style={{ marginTop: 'auto', paddingBottom: '24px' }}>
                    <Button
                        fullWidth
                        onClick={() => {
                            if (activeTab === 'airtime') handleAirtimeContinue();
                            else if (activeTab === 'data') handleDataContinue();
                            else if (activeTab === 'electricity') handleElectricityContinue();
                            else if (activeTab === 'tv') handleTvContinue();
                        }}
                        disabled={
                            (activeTab === 'data' && !selectedPlan) ||
                            (activeTab === 'electricity' && !verifiedName) ||
                            (activeTab === 'tv' && (isShowmax
                                ? (!tvBouquet || !isSmartcardValid(tvProvider, smartcardNumber))
                                : !tvVerifiedName))
                        }
                    >
                        Confirm Amount
                    </Button>
                </div>
            </div>
        </div>
    );
}
