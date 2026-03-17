import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import { createOnrampOrder, getOnrampRate } from '../../api/onramp';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount as useBscAccount } from 'wagmi';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { resolveSuinsName, isValidSuinsName } from '../../utils/suinsUtils';
import { resolveSolanaName, isValidSnsName, isValidSolanaAddress } from '../../utils/solanaUtils';
import { isValidAptosAddress, isValidAptosName, resolveAptosName } from '../../utils/aptosUtils';
import { isValidBscAddress } from '../../utils/bscUtils';
import usdcLogo from '../../assets/usdc-logo.png';
import nairaLogo from '../../assets/naira.png';
import { invalidateOrdersCache } from '../../utils/ordersCache';
import { useChain } from '../../context/ChainContext';
import ChainSelector from '../../components/ChainSelector';

export default function DepositAmount() {
    const navigate = useNavigate();
    const currentAccount = useCurrentAccount();
    const { publicKey: solanaPublicKey } = useWallet();
    const { account: aptosAccount } = useAptosWallet();
    const { address: bscAddress } = useBscAccount();
    const { selectedChain, setSelectedChain } = useChain();

    useEffect(() => {
        if (!['SUI', 'SOLANA'].includes(selectedChain)) {
            setSelectedChain('SUI');
        }
    }, [selectedChain, setSelectedChain]);

    const [currency, setCurrency] = useState<'USDC' | 'NGN'>('USDC');
    const [amount, setAmount] = useState('');
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [isLoadingRate, setIsLoadingRate] = useState(true);
    const [useConnectedWallet, setUseConnectedWallet] = useState(true);
    const [manualWalletAddress, setManualWalletAddress] = useState('');
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [isResolvingSuins, setIsResolvingSuins] = useState(false);
    const [suinsError, setSuinsError] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const rate = await getOnrampRate();
                setExchangeRate(rate);
            } catch (error) {
                console.error("Failed to fetch rate", error);
                toast.error("Failed to fetch exchange rate");
            } finally {
                setIsLoadingRate(false);
            }
        };
        fetchRate();
    }, []);

    useEffect(() => {
        const resolveName = async () => {
            setIsResolvingSuins(true);
            setSuinsError(false);
            setResolvedAddress(null);

            try {
                if (selectedChain === 'SUI') {
                    if (isValidSuinsName(manualWalletAddress)) {
                        const address = await resolveSuinsName(manualWalletAddress);
                        if (address) setResolvedAddress(address);
                        else setSuinsError(true);
                    } else {
                        setResolvedAddress(null);
                    }
                } else if (selectedChain === 'SOLANA') {
                    if (isValidSnsName(manualWalletAddress)) {
                        const address = await resolveSolanaName(manualWalletAddress);
                        if (address) setResolvedAddress(address);
                        else setSuinsError(true);
                    } else {
                        setResolvedAddress(null);
                    }
                } else if (selectedChain === 'APTOS') {
                    if (isValidAptosName(manualWalletAddress)) {
                        const address = await resolveAptosName(manualWalletAddress);
                        if (address) setResolvedAddress(address);
                        else setSuinsError(true);
                    } else {
                        setResolvedAddress(null);
                    }
                } else if (selectedChain === 'BSC') {
                    // BSC doesn't have a naming service
                    setResolvedAddress(null);
                }
            } catch (err) {
                setSuinsError(true);
            } finally {
                setIsResolvingSuins(false);
            }
        };

        const timeoutId = setTimeout(resolveName, 500);
        return () => clearTimeout(timeoutId);
    }, [manualWalletAddress, selectedChain]);

    const getWalletAddress = (): string | undefined => {
        if (useConnectedWallet) {
            if (selectedChain === 'SUI') return currentAccount?.address;
            if (selectedChain === 'SOLANA') return solanaPublicKey?.toBase58();
            if (selectedChain === 'APTOS') return aptosAccount?.address?.toString();
            if (selectedChain === 'BSC') return bscAddress;
        }
        return resolvedAddress || manualWalletAddress;
    };

    const handleContinue = async () => {
        const walletAddress = getWalletAddress();
        if (!walletAddress) {
            toast.error("Please provide a valid wallet address");
            return;
        }

        // Validate Address based on Chain
        if (selectedChain === 'SUI') {
            const suiRegex = /^0x[a-fA-F0-9]{64}$/;
            if (!suiRegex.test(walletAddress)) {
                toast.error("Invalid Sui address. Must start with 0x and have 64 hex characters.");
                return;
            }
        } else if (selectedChain === 'SOLANA') {
            if (!isValidSolanaAddress(walletAddress)) {
                toast.error("Invalid Solana address.");
                return;
            }
        } else if (selectedChain === 'APTOS') {
            if (!isValidAptosAddress(walletAddress)) {
                toast.error("Invalid Aptos address. Must start with 0x.");
                return;
            }
        } else if (selectedChain === 'BSC') {
            if (!isValidBscAddress(walletAddress)) {
                toast.error("Invalid BSC address. Must start with 0x and be 42 characters.");
                return;
            }
        }

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        let amountStableCoin = numAmount;
        if (currency === 'NGN') {
            // Convert NGN to USDC
            if (exchangeRate === 0) {
                toast.error("Exchange rate not available");
                return;
            }
            amountStableCoin = numAmount / exchangeRate;
        }

        setIsSubmitting(true);
        try {
            const response = await createOnrampOrder({
                amountStableCoin: amountStableCoin,
                currency: 'NGN',
                walletAddress: walletAddress,
                rate: exchangeRate,
                coin: {
                    sui: selectedChain === 'SUI',
                    base: false,
                    solana: selectedChain === 'SOLANA',
                    ethereum: false,
                    aptos: selectedChain === 'APTOS',
                    bsc: selectedChain === 'BSC'
                }
            });

            navigate('/deposit/payment', { state: { order: response } });
            invalidateOrdersCache(); // Refresh orders list
        } catch (error) {
            console.error("Failed to create order", error);
            toast.error("Failed to create deposit order. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculations for display
    const inputValue = parseFloat(amount) || 0;
    const convertedValue = currency === 'USDC'
        ? inputValue * exchangeRate
        : (exchangeRate > 0 ? inputValue / exchangeRate : 0);

    // Animation state
    const [isAnimatingConverted, setIsAnimatingConverted] = useState(false);

    useEffect(() => {
        setIsAnimatingConverted(true);
        const timer = setTimeout(() => setIsAnimatingConverted(false), 150);
        return () => clearTimeout(timer);
    }, [convertedValue]);

    return (
        <div className="page-enter" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <Header showBack />
                    <h1 style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '18px',
                        fontWeight: 600,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        color: 'var(--text-main)',
                    }}>Deposit USDC</h1>
                    <ChainSelector allowedChains={['SUI', 'SOLANA']} />
                </div>
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
                {/* Amount Input Card */}
                <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            I want to deposit
                        </label>
                        {/* Currency Toggle */}
                        <div style={{
                            background: 'var(--surface-elevated)',
                            borderRadius: '20px',
                            padding: '4px',
                            display: 'flex',
                            gap: '4px'
                        }}>
                            <button
                                onClick={() => setCurrency('USDC')}
                                style={{
                                    border: 'none',
                                    background: currency === 'USDC' ? 'var(--primary)' : 'transparent',
                                    color: currency === 'USDC' ? 'white' : 'var(--text-secondary)',
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                USDC
                            </button>
                            <button
                                onClick={() => setCurrency('NGN')}
                                style={{
                                    border: 'none',
                                    background: currency === 'NGN' ? 'var(--primary)' : 'transparent',
                                    color: currency === 'NGN' ? 'white' : 'var(--text-secondary)',
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <img src={nairaLogo} alt="₦" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                                NGN
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {currency === 'USDC' ? (
                            <div style={{
                                background: 'var(--surface-elevated)',
                                borderRadius: '12px',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <img
                                    src={usdcLogo}
                                    alt="USDC"
                                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                                />
                                <span style={{ fontWeight: 600 }}>USDC</span>
                            </div>
                        ) : (
                            <div style={{
                                background: 'var(--surface-elevated)',
                                borderRadius: '12px',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '17px', lineHeight: 1 }}>₦</span>
                                <span style={{ fontWeight: 600 }}>NGN</span>
                            </div>
                        )}

                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: amount.length > 10 ? '20px' : amount.length > 7 ? '26px' : '32px',
                                fontWeight: 700,
                                color: 'var(--text-main)',
                                width: '100%',
                                outline: 'none',
                                transition: 'font-size 0.2s ease'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Rate: {isLoadingRate ? '...' : `1 USDC = ₦${exchangeRate.toLocaleString()}`}
                        </p>
                        <p
                            className={isAnimatingConverted ? 'animate-digit-pulse' : ''}
                            style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', display: 'inline-block' }}
                        >
                            ≈ {currency === 'USDC' ? '₦' : ''}{convertedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency === 'USDC' ? '' : 'USDC'}
                        </p>
                    </div>
                </div>

                {/* Wallet Selection Card */}
                <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', flexShrink: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '16px', display: 'block' }}>
                        Wallet Address
                    </label>

                    {/* Connected Wallet Option */}
                    <div
                        onClick={() => {
                            if (currentAccount) {
                                setUseConnectedWallet(true);
                                setManualWalletAddress("");
                            }
                        }}
                        style={{
                            padding: '16px',
                            borderRadius: '16px',
                            background: useConnectedWallet ? 'var(--surface-elevated)' : 'transparent',
                            border: `1px solid ${useConnectedWallet ? 'var(--primary)' : 'var(--border-color)'}`,
                            marginBottom: '12px',
                            cursor: currentAccount ? 'pointer' : 'not-allowed',
                            opacity: currentAccount ? 1 : 0.6,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: `2px solid ${useConnectedWallet ? 'var(--primary)' : 'var(--text-muted)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {useConnectedWallet && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />}
                        </div>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                            <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>My {selectedChain === 'SUI' ? 'Sui' : selectedChain === 'SOLANA' ? 'Solana' : selectedChain === 'APTOS' ? 'Aptos' : 'BSC'} Wallet</p>
                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {selectedChain === 'SUI'
                                    ? (currentAccount ? currentAccount.address : 'No Sui wallet connected')
                                    : selectedChain === 'SOLANA'
                                        ? (solanaPublicKey ? solanaPublicKey.toBase58() : 'No Solana wallet connected')
                                        : selectedChain === 'APTOS'
                                            ? (aptosAccount?.address?.toString() || 'No Aptos wallet connected')
                                            : (bscAddress || 'No BSC wallet connected')
                                }
                            </p>
                        </div>
                        {useConnectedWallet && <CheckCircle size={20} className="text-primary" />}
                    </div>

                    {/* Manual Wallet Option */}
                    <div
                        onClick={() => setUseConnectedWallet(false)}
                        style={{
                            padding: '16px',
                            borderRadius: '16px',
                            background: !useConnectedWallet ? 'var(--surface-elevated)' : 'transparent',
                            border: `1px solid ${!useConnectedWallet ? 'var(--primary)' : 'var(--border-color)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: !useConnectedWallet ? '12px' : 0 }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: `2px solid ${!useConnectedWallet ? 'var(--primary)' : 'var(--text-muted)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {!useConnectedWallet && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>Send to Someone Else</p>
                                <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Enter address manually</p>
                            </div>
                            {!useConnectedWallet && <CheckCircle size={20} className="text-primary" />}
                        </div>

                        {!useConnectedWallet && (
                            <div className="animate-fadeIn" style={{ marginLeft: '32px' }}>
                                <input
                                    type="text"
                                    value={manualWalletAddress}
                                    onChange={(e) => setManualWalletAddress(e.target.value)}
                                    placeholder={selectedChain === 'SUI' ? "Enter address or SuiNS name (e.g. adewale.sui)" : selectedChain === 'SOLANA' ? "Enter address or SNS name (e.g. raj.sol)" : selectedChain === 'APTOS' ? "Enter Aptos address or .apt name" : "Enter BSC address (0x...)"}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'var(--input-bg)',
                                        border: suinsError ? '1px solid #FF5252' : 'none',
                                        color: 'var(--text-main)',
                                        fontSize: '10px',
                                        outline: 'none'
                                    }}
                                />
                                {isResolvingSuins && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '9px', color: 'var(--text-secondary)' }}>
                                        <Loader2 className="animate-spin" size={14} />
                                        <span>Resolving {selectedChain === 'SUI' ? 'SuiNS' : selectedChain === 'SOLANA' ? 'SNS' : 'ANS'}...</span>
                                    </div>
                                )}
                                {resolvedAddress && !isResolvingSuins && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: 'rgba(0, 200, 83, 0.1)',
                                        border: '1px solid rgba(0, 200, 83, 0.3)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <CheckCircle size={18} color="#00C853" />
                                        <div>
                                            <p style={{ fontWeight: 600, color: '#00C853', fontSize: '10px' }}>{manualWalletAddress}</p>
                                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                                {resolvedAddress}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {suinsError && !isResolvingSuins && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '9px', color: '#FF5252' }}>
                                        <AlertCircle size={14} />
                                        <span>Could not resolve {selectedChain === 'SUI' ? 'SuiNS' : 'SNS'} name</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '20px', background: 'var(--background)', flexShrink: 0, maxWidth: '600px', width: '100%', margin: '0 auto' }}>
                    <Button
                        fullWidth
                        onClick={handleContinue}
                        disabled={
                            isSubmitting ||
                            isLoadingRate ||
                            (!amount) ||
                            (!useConnectedWallet && !manualWalletAddress)
                        }
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={20} style={{ marginRight: '8px' }} />
                                Creating Order...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
