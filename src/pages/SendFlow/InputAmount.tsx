import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import { ArrowUpDown, Delete } from 'lucide-react';
import { fetchRate as fetchCachedRate } from '../../utils/rateCache';
import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useAccount, useReadContract } from 'wagmi';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { formatUnits } from 'viem';
import ChainSelector from '../../components/ChainSelector';
import { useChain } from '../../context/ChainContext';
import nairaLogo from '../../assets/naira.png';

export default function InputAmount() {
    const navigate = useNavigate();
    const location = useLocation();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currency, setCurrency] = useState<'USD' | 'NGN'>('USD');
    const [exchangeRate, setExchangeRate] = useState<number>(1460); // Default fallback
    const [justSwitched, setJustSwitched] = useState(false); // Track if currency was just switched
    const { selectedChain } = useChain();

    // Sui Wallet
    const currentAccount = useCurrentAccount();

    // Solana Wallet
    const { connection } = useConnection();
    const { publicKey: solanaPublicKey } = useWallet();
    const [solanaBalance, setSolanaBalance] = useState<number | null>(null);
    const [isSolanaLoading, setIsSolanaLoading] = useState(false);

    // EVM Wallet (Base/BSC)
    const { address: evmAddress } = useAccount();

    // Tron Wallet
    const { address: tronAddress } = useTronWallet();
    const [tronBalance, setTronBalance] = useState<number | null>(null);
    const [isTronLoading, setIsTronLoading] = useState(false);



    // Redirect to dashboard if state is missing (page was reloaded)
    const accountDetails = location.state as { accountNumber?: string; bankName?: string; recipientUsername?: string } | null;
    useEffect(() => {
        // Allow if we have account details OR a username
        if ((!accountDetails?.accountNumber || !accountDetails?.bankName) && !accountDetails?.recipientUsername) {
            navigate('/');
        }
    }, [accountDetails, navigate]);

    // Sui USDC coin type
    const SUI_USDC_COIN_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    // Solana USDC mint
    const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    // Base USDC Contract
    const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    // BSC USDC Contract (BEP20) - Fallback/Placeholder
    const BSC_USDC_CONTRACT = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

    // Get Sui USDC balance
    const { data: suiBalanceData, isPending: isSuiBalanceLoading } = useSuiClientQuery(
        'getBalance',
        {
            owner: currentAccount?.address || '',
            coinType: SUI_USDC_COIN_TYPE
        },
        { enabled: !!currentAccount?.address && selectedChain === 'SUI' }
    );

    // Get EVM USDC balance
    const isEvmChain = selectedChain === 'BASE' || selectedChain === 'BSC';
    const evmContractAddress = selectedChain === 'BASE' ? BASE_USDC_CONTRACT : BSC_USDC_CONTRACT;

    const targetChainId = selectedChain === 'BASE' ? 8453 : (selectedChain === 'BSC' ? 56 : undefined);

    const { data: evmBalanceData, isLoading: isEvmLoading } = useReadContract({
        address: evmContractAddress as `0x${string}`,
        abi: [{
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
        }],
        functionName: 'balanceOf',
        args: [evmAddress || '0x0000000000000000000000000000000000000000'],
        chainId: targetChainId,
        query: {
            enabled: !!evmAddress && isEvmChain && !!targetChainId,
        }
    });

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
                console.error("Error fetching Solana balance:", error);
                setSolanaBalance(null);
            } finally {
                setIsSolanaLoading(false);
            }
        };

        fetchSolanaBalance();
    }, [selectedChain, solanaPublicKey, connection]);

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
                console.error("Error fetching Tron balance:", error);
                setTronBalance(null);
            } finally {
                setIsTronLoading(false);
            }
        };

        fetchTronBalance();
    }, [selectedChain, tronAddress]);

    // Format USDC balance (USDC has 6 decimals on all supported chains usually, but check Base/BSC)
    // Base USDC is 6 decimals. BSC USDC is 18 decimals.
    const formatBalance = () => {
        if (selectedChain === 'SUI') {
            if (!currentAccount) return '0.00';
            if (isSuiBalanceLoading) return '...';
            if (!suiBalanceData) return '0.00';
            const usdcBalance = Number(suiBalanceData.totalBalance) / 1_000_000;
            return usdcBalance.toFixed(2);
        } else if (selectedChain === 'SOLANA') {
            if (!solanaPublicKey) return '0.00';
            if (isSolanaLoading) return '...';
            return (solanaBalance || 0).toFixed(2);
        } else if (isEvmChain) {
            if (!evmAddress) return '0.00';
            if (isEvmLoading) return '...';
            if (evmBalanceData === undefined) return '0.00';
            // Base USDC = 6 decimals, BSC USDC = 18 decimals
            const decimals = selectedChain === 'BASE' ? 6 : 18;
            const bal = Number(formatUnits(evmBalanceData as bigint, decimals));
            return bal.toFixed(2);
        } else if (selectedChain === 'TRON') {
            if (!tronAddress) return '0.00';
            if (isTronLoading) return '...';
            return (tronBalance || 0).toFixed(2);
        }
        return '0.00';
    };

    // Get numeric balance for percentage calculations
    const getNumericBalance = () => {
        if (selectedChain === 'SUI') {
            if (!currentAccount || !suiBalanceData) return 0;
            return Number(suiBalanceData.totalBalance) / 1_000_000;
        } else if (selectedChain === 'SOLANA') {
            if (!solanaPublicKey) return 0;
            return solanaBalance || 0;
        } else if (isEvmChain) {
            if (!evmAddress || evmBalanceData === undefined) return 0;
            const decimals = selectedChain === 'BASE' ? 6 : 18;
            return Number(formatUnits(evmBalanceData as bigint, decimals));
        } else if (selectedChain === 'TRON') {
            if (!tronAddress) return 0;
            return tronBalance || 0;
        }
        return 0;
    };

    useEffect(() => {
        fetchCachedRate(true).then(rate => {
            if (rate > 0) setExchangeRate(rate);
        }).catch(() => { /* keep default */ });
    }, []);

    const handleKeyPress = (key: string) => {
        if (key === 'delete') {
            setJustSwitched(false); // Clear the flag on delete
            setAmount(prev => prev.slice(0, -1));
        } else if (key === '.' && !justSwitched && amount.includes('.')) {
            return;
        } else if (justSwitched) {
            // After switching currencies, first keystroke overwrites the converted amount
            setJustSwitched(false);
            if (key === '.') {
                setAmount('0.');
            } else {
                setAmount(key);
            }
        } else if (key === '.') {
            // If starting with a dot, prefix with 0
            setAmount(prev => prev === '' ? '0.' : prev + key);
        } else {
            // Replace "0" with the new digit to prevent "02", "03", etc.
            setAmount(prev => prev === '0' ? key : prev + key);
        }
    };

    const toggleCurrency = () => {
        const numAmount = parseFloat(amount) || 0;
        if (currency === 'USD') {
            // Convert USD to NGN
            const ngnAmount = numAmount * exchangeRate;
            setAmount(ngnAmount.toFixed(0));
            setCurrency('NGN');
        } else {
            // Convert NGN to USD
            const usdAmount = numAmount / exchangeRate;

            const formattedUsd = usdAmount.toFixed(2);
            setAmount(parseFloat(formattedUsd) === 0 ? '0' : formattedUsd);
            setCurrency('USD');
        }
        setJustSwitched(true); // Mark that currency was just switched
    };

    // Calculate the equivalent amount in the other currency
    const getEquivalentAmount = () => {
        const numAmount = parseFloat(amount) || 0;
        if (currency === 'USD') {
            const ngnAmount = numAmount * exchangeRate;
            return `₦${ngnAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
        } else {
            const usdAmount = numAmount / exchangeRate;
            return `$${usdAmount.toFixed(2)}`;
        }
    };

    const percentages = ['25%', '50%', '75%', 'MAX'];
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];

    // Handle percentage button clicks
    const handlePercentage = (p: string) => {
        const balance = getNumericBalance();
        if (balance <= 0) return;

        let newAmount: number;
        switch (p) {
            case '25%':
                newAmount = balance * 0.25;
                break;
            case '50%':
                newAmount = balance * 0.50;
                break;
            case '75%':
                newAmount = balance * 0.75;
                break;
            case 'MAX':
                newAmount = balance;
                break;
            default:
                return;
        }

        // Convert to current currency if needed
        if (currency === 'NGN') {
            newAmount = newAmount * exchangeRate;
            setAmount(newAmount.toFixed(0));
        } else {
            setAmount(newAmount.toFixed(2));
        }
    };

    const [isAnimating, setIsAnimating] = useState(false);
    const [isFetchingRate, setIsFetchingRate] = useState(false);

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 150);
        return () => clearTimeout(timer);
    }, [amount]);

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
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
                }}>Input amount</h1>
                <ChainSelector />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* Amount Display */}
                <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h1
                        className={isAnimating ? 'animate-digit-pulse' : ''}
                        style={{
                            fontSize: amount.length > 10 ? '24px' : amount.length > 7 ? '34px' : '48px',
                            fontWeight: 700,
                            marginBottom: '16px', // Increased margin to separate from the switch below
                            color: 'var(--text-main)',
                            transition: 'font-size 0.2s ease',
                            display: 'flex', // Use flex to align symbol and currency
                            alignItems: 'baseline', // Align text by baseline
                            justifyContent: 'center',
                            gap: '4px'
                        }}>
                        {currency === 'NGN' && <span style={{ fontSize: 'clamp(14px, 4vw, 22px)', marginRight: '4px' }}>₦</span>}
                        {amount || '0'} <span style={{ fontSize: 'clamp(11px, 4vw, 17px)', color: 'var(--text-muted)' }}>{currency}</span>
                    </h1>
                    <button
                        onClick={toggleCurrency}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            background: 'var(--surface-elevated)', padding: '6px 16px', borderRadius: '20px', marginBottom: '16px',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', color: 'var(--text-main)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--border-color)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                    >
                        <span style={{ fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {getEquivalentAmount().startsWith('₦') ? (
                                <>
                                    <img src={nairaLogo} alt="₦" style={{ width: '12px', height: '12px' }} />
                                    {getEquivalentAmount().replace('₦', '')}
                                </>
                            ) : getEquivalentAmount()}
                        </span>
                        <ArrowUpDown size={14} />
                    </button>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(8px, 3.5vw, 10px)' }}>${formatBalance()} available</p>
                </div>

                {/* Keypad */}
                <div style={{ width: '100%', padding: '0 20px', marginBottom: '20px' }}>

                    {/* Percentages */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        {percentages.map(p => (
                            <button
                                key={p}
                                onClick={() => handlePercentage(p)}
                                style={{
                                    background: 'var(--input-bg)', border: 'none', borderRadius: '12px',
                                    padding: '8px 16px', fontSize: 'clamp(7px, 3vw, 8px)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
                                    transition: 'background-color 0.3s ease, color 0.3s ease'
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Keys */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {keys.map(key => (
                            <button
                                key={key}
                                onClick={() => handleKeyPress(key)}
                                style={{
                                    background: 'var(--surface)', border: 'none', borderRadius: '16px',
                                    height: 'clamp(50px, 12vw, 60px)', fontSize: 'clamp(13px, 5vw, 17px)', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--card-shadow)',
                                    transition: 'background-color 0.3s ease, color 0.3s ease'
                                }}
                            >
                                {key === 'delete' ? <Delete size={24} /> : key}
                            </button>
                        ))}
                    </div>


                    <div style={{ marginBottom: '16px' }}>
                        {error && (
                            <InlineError
                                message={error}
                                onDismiss={() => setError(null)}
                            />
                        )}
                    </div>

                    <Button
                        fullWidth
                        disabled={isFetchingRate}
                        onClick={async () => {
                            setError(null);

                            const numAmount = parseFloat(amount) || 0;
                            // Always calculate USD amount for sending
                            const usdAmount = currency === 'USD' ? numAmount : numAmount / exchangeRate;

                            if (usdAmount <= 0) {
                                setError("Please enter a valid amount greater than 0.");
                                return;
                            }

                            const balance = getNumericBalance();
                            if (usdAmount > balance) {
                                setError(`Insufficient funds. You have $${balance.toFixed(2)} available.`);
                                return;
                            }

                            // Fetch a fresh rate right before proceeding so the confirm page
                            // never receives a stale rate that the backend would reject.
                            setIsFetchingRate(true);
                            let freshRate = exchangeRate;
                            try {
                                const fetched = await fetchCachedRate(true);
                                if (fetched > 0) {
                                    freshRate = fetched;
                                    setExchangeRate(fetched);
                                }
                            } catch {
                                // keep the last known rate on network failure
                            } finally {
                                setIsFetchingRate(false);
                            }

                            // Calculate NGN equivalent using the just-fetched rate
                            const ngnAmount = currency === 'NGN' ? numAmount : usdAmount * freshRate;

                            navigate('/send/confirm', {
                                state: {
                                    ...location.state, // Preserve account details
                                    amount: usdAmount,
                                    ngnAmount: ngnAmount,
                                    currency: currency,
                                    rate: freshRate
                                }
                            });
                        }}
                    >
                        Confirm Amount
                    </Button>
                </div>
            </div>
        </div>
    );
}
