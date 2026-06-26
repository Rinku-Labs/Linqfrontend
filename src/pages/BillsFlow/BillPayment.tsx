import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient, ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction as SolTransaction } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress
} from '@solana/spl-token';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount as useBscAccount, useSendTransaction as useBscSendTransaction } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import Button from '../../components/ui/Button';
import { Loader2, CheckCircle, XCircle, Download } from 'lucide-react';
import { aptos, APTOS_USDC_ADDRESS } from '../../utils/aptosClient';
import { useWebSocket } from '../../hooks/useWebSocket';
import { playSuccessSound } from '../../utils/audio';
import { invalidateOrdersCache } from '../../utils/ordersCache';
import { getOrderStatus } from '../../api/order';
import { getBillStatus } from '../../api/bills';
import { useAuth } from '../../context/AuthContext';
import { sanitizeErrorMessage } from '../../utils/sanitize';
import { addBillBeneficiary, type AddBillBeneficiaryPayload } from '../../api/user';

const SUI_USDC_COIN_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BSC_USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as `0x${string}`;
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

type BillPaymentStatus = 'idle' | 'preparing' | 'signing' | 'processing' | 'success' | 'completed' | 'failed' | 'cancelled';

interface SuiCoin {
    coinObjectId: string;
    balance: string;
}

export default function BillPayment() {
    const location = useLocation();
    const navigate = useNavigate();

    // Sui Hooks
    const currentSuiAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const { mutate: signAndExecuteSuiTransaction } = useSignAndExecuteTransaction();

    // Solana Hooks
    const { connection } = useConnection();
    const { publicKey: solanaPublicKey, sendTransaction: sendSolanaTransaction } = useWallet();

    // Aptos Hooks
    const { account: aptosAccount, signAndSubmitTransaction: signAndSubmitAptosTransaction } = useAptosWallet();

    // BSC/Base Hooks (share wagmi)
    const { address: bscAddress } = useBscAccount();
    const { sendTransactionAsync: sendBscTransaction } = useBscSendTransaction();

    const { walletAddress, amount, orderId, chain, billData } = location.state || {};

    const [status, setStatus] = useState<BillPaymentStatus>('idle');
    const [message, setMessage] = useState('Initializing payment...');
    const [vendInfo, setVendInfo] = useState<{ token?: string; units?: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const hasInitiatedRef = useRef(false);

    // Prevent double-charge on page refresh:
    // Check if we already sent a transaction for this order
    useEffect(() => {
        if (orderId && sessionStorage.getItem(`billPayment_${orderId}`) === 'sent') {
            hasInitiatedRef.current = true;
            setStatus('processing');
            setMessage('Transaction sent! Processing your bill payment...');
        }
    }, [orderId]);

    // WebSocket Hook
    // The backend sends { orderId: string, data: { status: string, description: string } }
    type WebSocketMessage = {
        orderId: string;
        data: {
            status: string;
            description?: string;
        };
    };
    const { token } = useAuth();
    const { lastMessage, isConnected } = useWebSocket<WebSocketMessage>({ orderId, token: token ?? undefined });

    // Redirect if state is missing
    useEffect(() => {
        if (!walletAddress || !amount || !orderId) {
            navigate('/', { replace: true });
        }
    }, [walletAddress, amount, orderId, navigate]);

    // ============================================================
    // Per-chain payment handlers (same as SendFlow/Payment.tsx)
    // ============================================================

    const handleSuiPayment = async () => {
        if (!currentSuiAccount) return;

        try {
            const { data: coins } = await suiClient.getCoins({
                owner: currentSuiAccount.address,
                coinType: SUI_USDC_COIN_TYPE,
            });

            if (!coins || coins.length === 0) throw new Error("No USDC coins found in wallet");

            const tx = new Transaction();
            const amountInMist = Math.floor(parseFloat(amount) * 1_000_000);

            const totalBalance = (coins as any).reduce((sum: number, coin: SuiCoin) => sum + parseInt(coin.balance), 0);
            if (totalBalance < amountInMist) {
                throw new Error(`Insufficient USDC balance. Required: ${amount}, Available: ${(totalBalance / 1_000_000).toFixed(2)}`);
            }

            let primaryCoin = (coins as any).find((c: SuiCoin) => parseInt(c.balance) >= amountInMist);
            let coinToTransfer;

            if (primaryCoin) {
                const [splitCoin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amountInMist]);
                coinToTransfer = splitCoin;
            } else {
                const sortedCoins = (coins as any).sort((a: SuiCoin, b: SuiCoin) => parseInt(b.balance) - parseInt(a.balance));
                primaryCoin = sortedCoins[0];

                const coinsToMerge: SuiCoin[] = [];
                let currentBalance = parseInt(primaryCoin.balance);

                for (let i = 1; i < sortedCoins.length; i++) {
                    if (currentBalance >= amountInMist) break;
                    coinsToMerge.push(sortedCoins[i]);
                    currentBalance += parseInt(sortedCoins[i].balance);
                }

                if (coinsToMerge.length > 0) {
                    tx.mergeCoins(
                        tx.object(primaryCoin.coinObjectId),
                        coinsToMerge.map((c: SuiCoin) => tx.object(c.coinObjectId))
                    );
                }

                const [splitCoin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amountInMist]);
                coinToTransfer = splitCoin;
            }

            tx.transferObjects([coinToTransfer], walletAddress);

            setStatus('signing');
            setMessage('Please sign the transaction in your wallet...');

            signAndExecuteSuiTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        if (orderId) sessionStorage.setItem(`billPayment_${orderId}`, 'sent');
                        setStatus('processing');
                        setMessage('Transaction sent! Processing your bill payment...');
                    },
                    onError: () => {
                        setStatus('cancelled');
                        setMessage('Transaction was cancelled or rejected.');
                        hasInitiatedRef.current = false;
                    },
                }
            );
        } catch (error: unknown) {
            console.error("Sui Bill Payment failed:", error);
            setStatus('failed');
            setMessage(error instanceof Error ? error.message : 'Failed to prepare transaction.');
            hasInitiatedRef.current = false;
        }
    };

    const handleSolanaPayment = async () => {
        if (!solanaPublicKey) return;

        try {
            const amountInMicros = Math.floor(parseFloat(amount) * 1_000_000);
            const destinationWalletPubkey = new PublicKey(walletAddress);
            const mintPubkey = new PublicKey(SOLANA_USDC_MINT);

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                solanaPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const usdcAccount = tokenAccounts.value.find((account) =>
                account.account.data.parsed.info.mint === SOLANA_USDC_MINT
            );

            if (!usdcAccount) throw new Error("No USDC token account found.");

            const userTokenAccountPubkey = new PublicKey(usdcAccount.pubkey);
            const availableBalance = usdcAccount.account.data.parsed.info.tokenAmount.uiAmount * 1_000_000;

            if (availableBalance < amountInMicros) {
                throw new Error("Insufficient USDC balance.");
            }

            const destinationTokenAccount = await getAssociatedTokenAddress(mintPubkey, destinationWalletPubkey);
            const transaction = new SolTransaction();
            const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);

            if (!destinationAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        solanaPublicKey, destinationTokenAccount, destinationWalletPubkey, mintPubkey,
                        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            }

            transaction.add(
                createTransferInstruction(
                    userTokenAccountPubkey, destinationTokenAccount, solanaPublicKey,
                    amountInMicros, [], TOKEN_PROGRAM_ID
                )
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = solanaPublicKey;

            setStatus('signing');
            setMessage('Please sign the transaction in your Solana wallet...');

            const signature = await sendSolanaTransaction(transaction, connection);
            if (orderId) sessionStorage.setItem(`billPayment_${orderId}`, 'sent');
            setStatus('processing');
            setMessage('Transaction sent! Processing your bill payment...');
            await connection.confirmTransaction(signature, 'processed');
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Failed to prepare transaction.');
            hasInitiatedRef.current = false;
        }
    };

    const handleAptosPayment = async () => {
        if (!aptosAccount) return;

        try {
            const amountInMicros = Math.floor(parseFloat(amount) * 1_000_000);

            const balance = await aptos.getAccountCoinAmount({
                accountAddress: aptosAccount.address,
                coinType: APTOS_USDC_ADDRESS,
            });

            if (balance < amountInMicros) {
                throw new Error(`Insufficient Aptos USDC balance.`);
            }

            await signAndSubmitAptosTransaction({
                data: {
                    function: "0x1::aptos_account::transfer_coins",
                    typeArguments: [APTOS_USDC_ADDRESS],
                    functionArguments: [walletAddress, amountInMicros.toString()]
                }
            });

            if (orderId) sessionStorage.setItem(`billPayment_${orderId}`, 'sent');
            setStatus('processing');
            setMessage('Transaction sent! Processing your bill payment...');
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Failed to prepare transaction.');
            hasInitiatedRef.current = false;
        }
    };

    const handleBscPayment = async () => {
        if (!bscAddress) return;

        try {
            const amountInWei = parseUnits(amount.toString(), 18);

            const data = encodeFunctionData({
                abi: [{
                    name: 'transfer', type: 'function',
                    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [walletAddress as `0x${string}`, amountInWei]
            });

            await sendBscTransaction({ to: BSC_USDC_ADDRESS, data });
            if (orderId) sessionStorage.setItem(`billPayment_${orderId}`, 'sent');
            setStatus('processing');
            setMessage('Transaction sent! Processing your bill payment...');
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Failed to prepare transaction.');
            hasInitiatedRef.current = false;
        }
    };

    const handleBasePayment = async () => {
        if (!bscAddress) return;

        try {
            const amountInWei = parseUnits(amount.toString(), 6);

            const data = encodeFunctionData({
                abi: [{
                    name: 'transfer', type: 'function',
                    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [walletAddress as `0x${string}`, amountInWei]
            });

            await sendBscTransaction({ to: BASE_USDC_ADDRESS, data });
            if (orderId) sessionStorage.setItem(`billPayment_${orderId}`, 'sent');
            setStatus('processing');
            setMessage('Transaction sent! Processing your bill payment...');
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Failed to prepare transaction.');
            hasInitiatedRef.current = false;
        }
    };

    // ============================================================
    // Payment orchestration
    // ============================================================

    const handlePayment = useCallback(() => {
        if (!walletAddress || !amount) return;
        if (hasInitiatedRef.current) return;

        hasInitiatedRef.current = true;
        setStatus('preparing');
        setMessage('Preparing transaction...');

        if (chain === 'SOLANA') handleSolanaPayment();
        else if (chain === 'APTOS') handleAptosPayment();
        else if (chain === 'BSC') handleBscPayment();
        else if (chain === 'BASE') handleBasePayment();
        else handleSuiPayment();
    }, [amount, walletAddress, chain, currentSuiAccount, solanaPublicKey, aptosAccount, bscAddress, suiClient, connection]);

    // Auto-trigger when wallet is connected
    useEffect(() => {
        const isSuiReady = chain === 'SUI' && currentSuiAccount;
        const isSolanaReady = chain === 'SOLANA' && solanaPublicKey;
        const isAptosReady = chain === 'APTOS' && aptosAccount;
        const isBscReady = chain === 'BSC' && bscAddress;
        const isBaseReady = chain === 'BASE' && bscAddress;

        if (status === 'idle' && !hasInitiatedRef.current && walletAddress && (isSuiReady || isSolanaReady || isAptosReady || isBscReady || isBaseReady)) {
            handlePayment();
        }
    }, [status, chain, currentSuiAccount, solanaPublicKey, aptosAccount, bscAddress, handlePayment]);

    // ============================================================
    // Bill status via WebSocket
    // ============================================================

    useEffect(() => {
        if (!lastMessage || !orderId) return;
        if (status === 'completed' || status === 'failed') return;
        if (status === 'idle' || status === 'preparing' || status === 'signing') {
            // Only update if we are already processing or if the status indicates a move forward
            // But wait, if we are signing, we ignore?
            // Actually, we should respect WS updates if they are meaningful.
            // If backend says "crypto received", we should show it.
            // But we should verify if the user has signed yet.
            // If user hasn't signed, backend shouldn't know about order?
            // Backend only knows after deposit detected.
        }

        const payload = lastMessage;
        // Backend sends { orderId, data: { status, description } }

        if (!payload.data) return;

        const orderStatus = payload.data.status;
        const description = payload.data.description;


        if (orderStatus === 'completed') {
            setStatus('completed');
            setMessage('Bill payment successful!');
            if (orderId) sessionStorage.removeItem(`billPayment_${orderId}`);
            if (billData) {
                addBillBeneficiary(billData as AddBillBeneficiaryPayload).catch(err => console.error('Failed to save beneficiary:', err));
            }
            invalidateOrdersCache();
        } else if (orderStatus === 'failed' || orderStatus === 'timeout: no deposit received') {
            if (orderId) sessionStorage.removeItem(`billPayment_${orderId}`);
            setStatus('failed');

            const sanitizedDescription = sanitizeErrorMessage(description);

            setMessage(orderStatus === 'timeout: no deposit received'
                ? 'No deposit received. Please try again.'
                : sanitizedDescription);
            invalidateOrdersCache();
        } else if (orderStatus === 'paying bill') {
            setMessage('Paying your bill...');
        } else if (orderStatus === 'crypto received') {
            setMessage('Deposit confirmed! Processing bill payment...');
        } else if (orderStatus === 'wallet working' || orderStatus === 'awaiting crypto') {
            setMessage('Verifying your transaction...');
        }
    }, [lastMessage, orderId, status]);

    // One-shot status check on mount — catches orders already completed before WS connected
    useEffect(() => {
        if (!orderId) return;
        getOrderStatus(orderId).then(data => {
            if (!data?.status) return;
            if (data.status === 'completed' && status !== 'completed') {
                setStatus('completed');
                setMessage('Bill payment successful!');
                sessionStorage.removeItem(`billPayment_${orderId}`);
                if (billData) {
                    addBillBeneficiary(billData as AddBillBeneficiaryPayload).catch(err => console.error('Failed to save beneficiary:', err));
                }
                invalidateOrdersCache();
            } else if ((data.status === 'failed' || data.status === 'timeout: no deposit received') && status !== 'failed') {
                sessionStorage.removeItem(`billPayment_${orderId}`);
                setStatus('failed');
                setMessage(data.status === 'timeout: no deposit received'
                    ? 'No deposit received. Please try again.'
                    : 'Transaction failed.');
                invalidateOrdersCache();
            }
        }).catch(() => { /* WS will cover it */ });
    }, [orderId]);

    // Polling fallback — only runs when WS is disconnected and status is non-terminal
    useEffect(() => {
        if (!orderId) return;
        if (isConnected) return;
        if (['completed', 'failed', 'cancelled'].includes(status)) return;

        const interval = setInterval(() => {
            getOrderStatus(orderId).then(data => {
                if (!data?.status) return;
                if (data.status === 'completed' && status !== 'completed') {
                    setStatus('completed');
                    setMessage('Bill payment successful!');
                    sessionStorage.removeItem(`billPayment_${orderId}`);
                    if (billData) {
                        addBillBeneficiary(billData as AddBillBeneficiaryPayload).catch(err => console.error('Failed to save beneficiary:', err));
                    }
                    invalidateOrdersCache();
                    clearInterval(interval);
                } else if ((data.status === 'failed' || data.status === 'timeout: no deposit received') && status !== 'failed') {
                    sessionStorage.removeItem(`billPayment_${orderId}`);
                    setStatus('failed');
                    setMessage(data.status === 'timeout: no deposit received'
                        ? 'No deposit received. Please try again.'
                        : 'Transaction failed.');
                    invalidateOrdersCache();
                    clearInterval(interval);
                }
            }).catch(() => {});
        }, 8000);

        return () => clearInterval(interval);
    }, [orderId, isConnected, status]);

    // Play success sound when bill is completed
    useEffect(() => {
        if (status === 'completed') {
            playSuccessSound();
        }
    }, [status]);

    // For completed prepaid electricity, fetch the recharge token/units so the
    // user can load their meter. The token is only returned by /bills/status.
    useEffect(() => {
        if (status !== 'completed' || !orderId) return;
        const billType = String(billData?.billType || '').toUpperCase();
        if (billType !== 'ELECTRICITY' && billType !== 'UTILITYBILLS') return;
        if (vendInfo?.token) return;

        getBillStatus(orderId)
            .then((order) => {
                if (order?.vendToken) {
                    setVendInfo({ token: order.vendToken, units: order.vendUnits });
                }
            })
            .catch(() => { /* token is best-effort; receipt still has it */ });
    }, [status, orderId, billData, vendInfo]);

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>

                {/* Loading/Processing spinner */}
                {(status === 'preparing' || status === 'signing' || status === 'processing') && (
                    <Loader2 className="animate-spin" size={64} style={{ color: 'var(--primary)', marginBottom: '24px' }} />
                )}

                {/* Failed/Cancelled icon */}
                {(status === 'failed' || status === 'cancelled') && (
                    <XCircle size={64} style={{ color: 'red', marginBottom: '24px' }} />
                )}

                {/* Completed state */}
                {status === 'completed' ? (
                    <div style={{ width: '100%', animation: 'fadeIn 0.5s ease-out' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', margin: '0 auto',
                            border: '4px solid rgba(124, 58, 237, 0.1)'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <CheckCircle color="white" size={24} />
                            </div>
                        </div>

                        <h1 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)', textAlign: 'center', marginTop: '16px' }}>
                            🎉 Bill Paid!
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '32px', textAlign: 'center' }}>
                            {billData?.itemName} delivered to {billData?.customerId}
                        </p>

                        <div className="glass-card" style={{ borderRadius: '24px', padding: '24px', width: '100%', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Status</span>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>Completed</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Amount</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>₦{billData?.amountNgn?.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>USDC Paid</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>${Number(amount).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Order ID</span>
                                <span style={{ fontWeight: 600, fontSize: '9px', color: 'var(--text-main)' }}>{orderId?.slice(0, 18)}...</span>
                            </div>
                        </div>

                        {/* Prepaid electricity recharge token — the value the customer needs to load their meter */}
                        {vendInfo?.token && (
                            <div className="glass-card" style={{ borderRadius: '24px', padding: '20px', width: '100%', marginBottom: '24px', border: '1px solid var(--primary)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '8px', textAlign: 'left' }}>
                                    Recharge Token — enter this on your meter
                                </p>
                                <div
                                    onClick={() => {
                                        if (vendInfo.token) {
                                            navigator.clipboard?.writeText(vendInfo.token).then(() => {
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }).catch(() => { /* clipboard unavailable */ });
                                        }
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                                >
                                    <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '1px', color: 'var(--text-main)', wordBreak: 'break-all', textAlign: 'left' }}>
                                        {vendInfo.token}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                                        {copied ? 'Copied!' : 'Tap to copy'}
                                    </span>
                                </div>
                                {vendInfo.units && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Units</span>
                                        <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-main)' }}>{vendInfo.units}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <Button
                                variant="ghost"
                                onClick={() => navigate(`/transactions/${orderId}`)}
                                style={{ flex: 1, background: 'var(--surface-elevated)', color: 'var(--text-main)', borderRadius: '16px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Download size={20} />
                                    <span>Receipt</span>
                                </div>
                            </Button>
                            <Button style={{ flex: 1, borderRadius: '16px' }} onClick={() => navigate('/')}>
                                Return Home
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Wallet connection prompt if not connected */}
                        {status === 'idle' && (
                            (chain === 'SUI' && !currentSuiAccount) ||
                            (chain === 'SOLANA' && !solanaPublicKey) ||
                            (chain === 'APTOS' && !aptosAccount) ||
                            (chain === 'BSC' && !bscAddress) ||
                            (chain === 'BASE' && !bscAddress)
                        ) && (
                                <div style={{ marginBottom: '20px' }}>
                                    <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                        Connect your {chain === 'SOLANA' ? 'Solana' : chain === 'APTOS' ? 'Aptos' : chain === 'BSC' ? 'BSC' : chain === 'BASE' ? 'Base' : 'Sui'} wallet to continue
                                    </p>
                                    {chain === 'SOLANA' && <WalletMultiButton />}
                                    {chain === 'SUI' && <ConnectButton />}
                                    {(chain === 'APTOS' || chain === 'BSC' || chain === 'BASE') && (
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Please connect via Settings page</p>
                                    )}
                                </div>
                            )}

                        <h2 style={{ marginTop: '24px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {status === 'idle' && 'Initializing...'}
                            {status === 'preparing' && 'Preparing Transaction'}
                            {status === 'signing' && 'Sign Transaction'}
                            {status === 'processing' && 'Processing Bill Payment'}
                            {status === 'failed' && 'Payment Failed'}
                            {status === 'cancelled' && 'Transaction Cancelled'}
                        </h2>
                        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                            {status === 'failed' || status === 'cancelled' ? '' : message}
                        </p>

                        {(status === 'failed' || status === 'cancelled') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', width: '100%' }}>
                                <Button fullWidth onClick={() => {
                                    // Navigate back to confirm page to create a NEW order
                                    // This ensures a fresh worker is started for the new wallet
                                    navigate('/bills/confirm', { state: billData });
                                }}>
                                    Try Again
                                </Button>
                                <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
                                    Return Home
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
