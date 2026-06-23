import { ArrowUpRight, ArrowDownLeft, RefreshCw, Smartphone, Zap, Eye, EyeOff, Wallet, Inbox, Copy } from 'lucide-react';
import ProductTour from '../components/ProductTour';
import { getTransactionIcon } from '../utils/transactionIcons';
import clickToEarnImg from '../assets/click-to-earn.png';
import logo from '../assets/logo.png';
import nairaLogo from '../assets/naira.png';
import balanceCardBg from '../assets/balance-card-bg.png';
import Button from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import TransactionPopup, { formatStatus, getStatusStyle } from '../components/TransactionPopup';

import type { Order } from '../components/TransactionPopup';

import { fetchOrders } from '../utils/ordersCache';
import { fetchRate } from '../utils/rateCache';
import { getRewardsData } from '../api/rewards';
import type { RewardsData } from '../api/rewards';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import FeatureDiscoveryPopup from '../components/FeatureDiscoveryPopup';
import FeatureExplainerModal from '../components/FeatureExplainerModal';
import { useSavings } from '../context/SavingsContext';
import { formatDate } from '../utils/dateFormatter';
import { BalanceCardSkeleton, TransactionListSkeleton, QuickActionsSkeleton } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import usePullToRefresh, { PullToRefreshIndicator } from '../hooks/usePullToRefresh';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount, useReadContract } from 'wagmi';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useChain } from '../context/ChainContext';
import ChainSelector from '../components/ChainSelector';
import { aptos, APTOS_USDC_ADDRESS } from '../utils/aptosClient';

// BSC USDC Contract ABI for balanceOf
const BSC_USDC_ABI = [{
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
}] as const;

export default function Home() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [showBalance, setShowBalance] = useState(() => {
        const saved = localStorage.getItem('showBalance');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('showBalance', JSON.stringify(showBalance));
    }, [showBalance]);

    const username = user?.username || localStorage.getItem('linqUsername') || 'Guest';
    const { selectedChain } = useChain();

    // Sui Wallet
    const currentAccount = useCurrentAccount();

    // Solana Wallet
    const { connection } = useConnection();
    const { publicKey: solanaPublicKey } = useWallet();
    const [solanaBalance, setSolanaBalance] = useState<number | null>(null);
    const [isSolanaLoading, setIsSolanaLoading] = useState(false);

    // Aptos Wallet
    const { account: aptosAccount } = useAptosWallet();
    const [aptosBalance, setAptosBalance] = useState<number | null>(null);
    const [isAptosLoading, setIsAptosLoading] = useState(false);

    // EVM Wallet (BSC & Base)
    const { address: evmAddress } = useAccount();
    const BSC_USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as `0x${string}`;
    const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

    // Tron Wallet
    const { address: tronAddress } = useTronWallet();
    const [tronBalance, setTronBalance] = useState<number | null>(null);
    const [isTronLoading, setIsTronLoading] = useState(false);

    const isEvmChain = selectedChain === 'BSC' || selectedChain === 'BASE';
    const evmContractAddress = selectedChain === 'BASE' ? BASE_USDC_ADDRESS : BSC_USDC_ADDRESS;
    const targetChainId = selectedChain === 'BASE' ? 8453 : (selectedChain === 'BSC' ? 56 : undefined);

    const { data: evmBalanceData, isLoading: isEvmLoading } = useReadContract({
        address: evmContractAddress,
        abi: BSC_USDC_ABI,
        functionName: 'balanceOf',
        args: evmAddress ? [evmAddress] : undefined,
        chainId: targetChainId,
        query: { enabled: !!evmAddress && isEvmChain && !!targetChainId }
    });

    const [transactions, setTransactions] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const hasPendingRef = useRef(false);
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [isOrdersLoading, setIsOrdersLoading] = useState(true);
    const [isRateLoading, setIsRateLoading] = useState(true);
    const [isRewardsLoading, setIsRewardsLoading] = useState(true);
    const [rewardsData, setRewardsData] = useState<RewardsData | null>(null);
    const { history: savingsHistory } = useSavings();

    // USDC coin type on Sui mainnet
    const USDC_COIN_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    // USDC mint on Solana
    const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';


    // Get USDC wallet balance if connected
    const { data: balanceData, isPending: isBalanceLoading } = useSuiClientQuery(
        'getBalance',
        {
            owner: currentAccount?.address || '',
            coinType: USDC_COIN_TYPE
        },
        { enabled: !!currentAccount?.address && selectedChain === 'SUI' }
    );

    // Get Solana USDC balance
    useEffect(() => {
        const fetchSolanaBalance = async () => {
            if (selectedChain !== 'SOLANA' || !solanaPublicKey) return;

            setIsSolanaLoading(true);
            try {
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    solanaPublicKey,
                    { programId: TOKEN_PROGRAM_ID }
                );

                const usdcAccount = tokenAccounts.value.find((account: any) =>
                    account.account.data.parsed.info.mint === SOLANA_USDC_MINT
                );

                if (usdcAccount) {
                    setSolanaBalance(usdcAccount.account.data.parsed.info.tokenAmount.uiAmount);
                } else {
                    setSolanaBalance(0);
                }
            } catch (error) {
                setSolanaBalance(null);
            } finally {
                setIsSolanaLoading(false);
            }
        };

        fetchSolanaBalance();
    }, [selectedChain, solanaPublicKey, connection]);

    // Get Aptos USDC balance
    useEffect(() => {
        const fetchAptosBalance = async () => {
            if (selectedChain !== 'APTOS' || !aptosAccount) return;

            setIsAptosLoading(true);
            try {
                // Fetch Aptos balance using SDK
                const balance = await aptos.getAccountCoinAmount({
                    accountAddress: aptosAccount.address,
                    coinType: APTOS_USDC_ADDRESS,
                });
                setAptosBalance(balance / 1_000_000);
            } catch (error) {
                setAptosBalance(null);
            } finally {
                setIsAptosLoading(false);
            }
        };

        fetchAptosBalance();
    }, [selectedChain, aptosAccount]);

    // Get Tron USDC balance
    useEffect(() => {
        const fetchTronBalance = async () => {
            if (selectedChain !== 'TRON' || !tronAddress) return;

            const tronWeb = (window as any).tronWeb;
            if (!tronWeb || !tronWeb.ready) return;

            setIsTronLoading(true);
            try {
                // TRC20 balance requires contract call
                const contract = await tronWeb.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'); // USDT on Tron
                const balance = await contract.balanceOf(tronAddress).call();
                // USDT on Tron has 6 decimals
                setTronBalance(parseInt(balance.toString()) / 1_000_000);
            } catch (error) {
                setTronBalance(null);
            } finally {
                setIsTronLoading(false);
            }
        };

        fetchTronBalance();
    }, [selectedChain, tronAddress]);

    const loadAllData = useCallback((isSilent = false, forceRefresh = false) => {
        if (!isSilent) {
            setIsOrdersLoading(true);
            setIsRateLoading(true);
            setIsRewardsLoading(true);
        }

        fetchOrders(100, forceRefresh)
            .then(orders => setTransactions(orders))
            .catch(() => { /* keep previous */ })
            .finally(() => { if (!isSilent) setIsOrdersLoading(false); });

        fetchRate()
            .then(rate => setExchangeRate(rate))
            .catch(() => { /* keep previous */ })
            .finally(() => { if (!isSilent) setIsRateLoading(false); });

        getRewardsData()
            .then(rewards => setRewardsData(rewards))
            .catch(() => { /* keep previous */ })
            .finally(() => { if (!isSilent) setIsRewardsLoading(false); });
    }, []);

    // Use WebSocket to listen for real-time updates for this user
    // We need the numeric user ID. Assuming user object has it, or we decode from token/localstorage if needed.
    // For now, attempting to use user?.id. If user ID is not available in context, we might need to fetch it.
    // Based on Admin panel showing "UserID: 3", it's a number.
    const { lastMessage } = useWebSocket(user?.id ? { userId: user.id.toString(), token: token ?? undefined } : undefined);

    // Trigger refresh when a WS message is received
    useEffect(() => {
        if (lastMessage) {
            // Force refresh to bypass cache and show the new status
            loadAllData(true, true);
        }
    }, [lastMessage, loadAllData]);

    useEffect(() => {
        loadAllData();

        // Poll for updates every 10 seconds (reduced frequency now that we have WS)
        const intervalId = setInterval(() => {
            loadAllData(true);
        }, 10000);

        return () => clearInterval(intervalId);
    }, [loadAllData]);

    // Pull-to-refresh
    const { isRefreshing, pullDistance, handlers: pullHandlers } = usePullToRefresh({
        onRefresh: () => loadAllData(false),
    });

    const { feature: discoveryFeature, showPopup: showDiscoveryPopup, handleClose: handleDiscoveryClose, handleCtaClick: handleDiscoveryCta } = useFeatureDiscovery(
        transactions,
        rewardsData,
        savingsHistory.length > 0,
        !isOrdersLoading && !isRewardsLoading
    );

    // Format USDC balance (USDC has 6 decimals on most chains, 18 on BSC)
    const formatBalance = () => {
        if (selectedChain === 'SUI') {
            if (!currentAccount) return '0.00';
            if (isBalanceLoading) return '...';
            if (!balanceData) return '0.00';
            const usdcBalance = Number(balanceData.totalBalance) / 1_000_000;
            return usdcBalance.toFixed(2);
        } else if (selectedChain === 'SOLANA') {
            if (!solanaPublicKey) return '0.00';
            if (isSolanaLoading) return '...';
            return (solanaBalance || 0).toFixed(2);
        } else if (selectedChain === 'APTOS') {
            if (!aptosAccount) return '0.00';
            if (isAptosLoading) return '...';
            return (aptosBalance || 0).toFixed(2);
        } else if (isEvmChain) {
            if (!evmAddress) return '0.00';
            if (isEvmLoading) return '...';
            // Base USDC = 6 decimals, BSC USDC = 18 decimals
            const decimals = selectedChain === 'BASE' ? 6 : 18;
            const balance = evmBalanceData ? Number(evmBalanceData) / Math.pow(10, decimals) : 0;
            return balance.toFixed(2);
        } else if (selectedChain === 'TRON') {
            if (!tronAddress) return '0.00';
            if (isTronLoading) return '...';
            return (tronBalance || 0).toFixed(2);
        }
        return '0.00';
    };

    // Format Naira balance
    const formatNairaBalance = () => {
        let usdcBalance = 0;
        if (selectedChain === 'SUI') {
            if (!currentAccount || isBalanceLoading || !balanceData) return '0.00';
            usdcBalance = Number(balanceData.totalBalance) / 1_000_000;
        } else if (selectedChain === 'SOLANA') {
            if (!solanaPublicKey) return '0.00';
            usdcBalance = solanaBalance || 0;
        } else if (selectedChain === 'APTOS') {
            if (!aptosAccount) return '0.00';
            usdcBalance = aptosBalance || 0;
        } else if (isEvmChain) {
            if (!evmAddress) return '0.00';
            const decimals = selectedChain === 'BASE' ? 6 : 18;
            usdcBalance = evmBalanceData ? Number(evmBalanceData) / Math.pow(10, decimals) : 0;
        } else if (selectedChain === 'TRON') {
            if (!tronAddress) return '0.00';
            usdcBalance = tronBalance || 0;
        }

        const nairaAmount = usdcBalance * exchangeRate;
        return nairaAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="page-enter" style={{ paddingBottom: '20px' }} {...pullHandlers}>
            <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                        <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Welcome back,</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                @{username?.toLowerCase()}
                            </p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(`@${username?.toLowerCase()}`);
                                    const btn = e.currentTarget;
                                    const originalContent = btn.innerHTML;
                                    btn.innerHTML = '✓';
                                    setTimeout(() => {
                                        btn.innerHTML = originalContent;
                                    }, 2000);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-secondary)',
                                    fontSize: '10px' // For the checkmark
                                }}
                                title="Copy username"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                    <ChainSelector />
                    <ThemeToggle />
                </div>
            </div>

            {/* Balance Card — show skeleton until rate is loaded */}
            {isRateLoading ? (
                <BalanceCardSkeleton />
            ) : (
                <div className="glow-on-hover" style={{
                    backgroundImage: `url(${balanceCardBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '24px',
                    padding: 'clamp(20px, 5vw, 32px) clamp(16px, 4vw, 24px)',
                    color: 'white',
                    marginBottom: '24px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                            {(currentAccount || solanaPublicKey || aptosAccount || evmAddress || tronAddress) ? 'USDC Balance' : 'Wallet Balance'}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <h1 style={{ fontSize: 'clamp(20px, 8vw, 29px)', fontWeight: 700, transition: 'all 0.3s ease', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span className={showBalance ? '' : 'balance-hidden'} style={{ transition: 'filter 0.3s ease' }}>
                                        {showBalance ? `$${formatBalance()}` : '•••••'}
                                    </span>
                                </h1>
                                <button onClick={() => setShowBalance(!showBalance)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                    {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {showBalance && exchangeRate > 0 && (
                                <p style={{
                                    fontSize: formatNairaBalance().length > 10 ? '14px' : '16px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontWeight: 500,
                                    marginTop: '-4px'
                                }}>
                                    ≈ <img src={nairaLogo} alt="₦" style={{ width: '14px', height: '14px', marginRight: '2px', verticalAlign: 'middle' }} />{formatNairaBalance()}

                                </p>
                            )}
                        </div>
                        {!(currentAccount || solanaPublicKey || aptosAccount || evmAddress || tronAddress) && showBalance && (
                            <button
                                onClick={() => navigate('/settings')}
                                style={{
                                    fontSize: '9px',
                                    color: 'rgba(255,255,255,0.9)',
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '16px',
                                    padding: '6px 12px',
                                    marginTop: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Wallet size={14} />
                                Connect Wallet
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Button
                            id="tour-transfer"
                            variant="secondary"
                            fullWidth
                            onClick={() => navigate('/send/details')}
                            style={{
                                borderRadius: '12px',
                                height: '48px'
                            }}
                        >
                            <ArrowUpRight size={20} /> Transfer
                        </Button>
                        <Button
                            id="tour-deposit"
                            variant="secondary"
                            fullWidth
                            onClick={() => navigate('/deposit')}
                            style={{ borderRadius: '12px', height: '48px' }}
                        >
                            <ArrowDownLeft size={20} /> Deposit
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick Actions — always visible, no data dependency */}
            {false ? (
                <QuickActionsSkeleton />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
                    {[
                        { label: 'Swap', icon: RefreshCw, comingSoon: false, path: '/swap' },
                        { label: 'Top Up', icon: Smartphone, comingSoon: false, path: '/bills/topup' },
                        { label: 'Electricity', icon: Zap, comingSoon: false, path: '/bills/topup?tab=electricity' }
                    ].map((item) => (
                        <button key={item.label} id={item.label === 'Swap' ? 'tour-swap' : item.label === 'Top Up' ? 'tour-topup' : undefined} className="card-interactive" onClick={() => !item.comingSoon && navigate(item.path)} style={{
                            background: 'var(--surface)', borderRadius: '20px', padding: '16px', border: 'none',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                            boxShadow: 'var(--card-shadow)', cursor: item.comingSoon ? 'default' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: item.comingSoon ? 0.6 : 1,
                            position: 'relative',
                        }}>
                            <item.icon size={24} color="var(--text-main)" />
                            <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-main)' }}>{item.label}</span>
                            {item.comingSoon && (
                                <span style={{
                                    position: 'absolute', top: '6px', right: '6px',
                                    fontSize: '9px', fontWeight: 700, color: 'var(--primary)',
                                    background: 'rgba(139, 92, 246, 0.12)', padding: '2px 6px',
                                    borderRadius: '6px', letterSpacing: '0.3px',
                                }}>SOON</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Earn Rewards Banner */}
            <div
                id="tour-rewards"
                onClick={() => navigate('/rewards')}
                className="card-interactive"
                style={{
                    marginBottom: '24px',
                    cursor: 'pointer',
                    boxShadow: 'var(--card-shadow)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    display: 'flex'
                }}
            >
                <img 
                    src={clickToEarnImg} 
                    alt="Earn Rewards" 
                    style={{ width: '100%', height: 'auto', display: 'block' }} 
                />
            </div>

            {/* Volume Tracker - HIDDEN */}
            {/* {isDataLoading ? (
                <VolumeTrackerSkeleton />
            ) : (
                <div className="glass-card animate-slideUp stagger-2" style={{ borderRadius: '20px', padding: '20px', marginBottom: '24px', animationFillMode: 'backwards', transition: 'background-color 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Today's off-ramp volume</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Limit: ${DAILY_LIMIT}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>${dailyVolume.toFixed(2)}</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'var(--progress-bg)', borderRadius: '3px', marginTop: '12px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                            position: 'absolute', left: 0, top: 0, height: '100%',
                            width: `${Math.min((dailyVolume / DAILY_LIMIT) * 100, 100)}%`,
                            background: dailyVolume >= DAILY_LIMIT ? 'var(--error)' : 'linear-gradient(90deg, var(--primary), var(--primary-light))',
                            borderRadius: '3px',
                            transition: 'width 1s ease-out',
                            animation: 'progressFill 1s ease-out forwards',
                            animationDelay: '0.5s'
                        }}></div>
                    </div>
                    {dailyVolume >= DAILY_LIMIT && (
                        <p style={{ fontSize: '9px', color: 'var(--error)', marginTop: '8px', fontWeight: 500 }}>
                            Daily limit reached. Resets at 00:00 UTC.
                        </p>
                    )}
                </div>
            )} */}

            {/* Recent Transactions */}
            {isOrdersLoading ? (
                <TransactionListSkeleton count={4} />
            ) : (
                <div className="glass-card animate-slideUp stagger-3" style={{ borderRadius: '24px', padding: '24px', animationFillMode: 'backwards', transition: 'background-color 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Recent Transactions</h3>
                        <button
                            onClick={() => navigate('/transactions')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '9px', cursor: 'pointer' }}
                        >
                            See More
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {transactions.length === 0 ? (
                            <EmptyState
                                icon={Inbox}
                                title="No transactions yet"
                                description="Your recent transactions will appear here once you make your first transfer."
                                actionLabel="Send Money"
                                onAction={() => navigate('/send/details')}
                                variant="inline"
                            />
                        ) : (
                            transactions.slice(0, 5).map((trx, index) => (
                                <div
                                    key={trx.id || index}
                                    onClick={() => setSelectedOrder(trx)}
                                    className={`animate-fadeIn stagger-${index + 1} card-interactive`}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0, animationFillMode: 'forwards', animationDelay: `${0.1 * (index + 1)}s`, cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%', background: getStatusStyle(trx.status).bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {(() => { const Icon = getTransactionIcon(trx); return <Icon size={20} color={getStatusStyle(trx.status).color} />; })()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '10px', fontWeight: 500, marginBottom: '2px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{trx.accountName || trx.bankName || 'Transfer'}</p>
                                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDate(trx.createdAt)}</span>
                                                <span className={`status-badge ${formatStatus(trx.status) === 'Pending' ? 'status-badge--pending' : ''}`} style={{
                                                    color: getStatusStyle(trx.status).color,
                                                    background: getStatusStyle(trx.status).bg,
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    marginLeft: '6px',
                                                    fontSize: '9px',
                                                    flexShrink: 0,
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {formatStatus(trx.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '80px', flexShrink: 0 }}>
                                        <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            ${trx.amountStableCoin?.toFixed(2) || '0.00'}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                                            <img src={nairaLogo} alt="₦" style={{ width: '10px', height: '10px' }} />
                                            <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{trx.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }) || '0'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Transaction Popup */}
            <TransactionPopup
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
            />

            {/* Feature Discovery Popup */}
            {showDiscoveryPopup && discoveryFeature && (
                <FeatureDiscoveryPopup
                    feature={discoveryFeature}
                    onClose={handleDiscoveryClose}
                    onCtaClick={handleDiscoveryCta}
                />
            )}

            {/* Feature Explainer (for multi-chain which navigates to /) */}
            <FeatureExplainerModal />

            {/* Onboarding Product Tour (new users only) */}
            <ProductTour />

        </div>
    );
}

