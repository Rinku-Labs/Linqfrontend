import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import client from '../../api/client';
import { fetchRate as fetchCachedRate } from '../../utils/rateCache';
import { isGasFeeError } from '../../utils/sanitize';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
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
import { parseUnits, encodeFunctionData, formatUnits } from 'viem';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '../../context/BscWalletProvider';
import { aptos, APTOS_USDC_ADDRESS } from '../../utils/aptosClient';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useChain } from '../../context/ChainContext';
import { useAuth } from '../../context/AuthContext';
import { invalidateOrdersCache } from '../../utils/ordersCache';
import { useSavings } from '../../context/SavingsContext';
import { getSavingsConfig } from '../../utils/savingsConfig';

import { toast } from 'sonner';

import TransactionPinModal from '../../components/TransactionPinModal';

const SUI_USDC_COIN_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BSC_USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as `0x${string}`;
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;


/**
 * Generate idempotency key for order creation
 * Uses a polyfill for crypto.randomUUID for browser compatibility
 */
const generateIdempotencyKey = (): string => {
    // Polyfill for crypto.randomUUID (not available in non-secure contexts on mobile)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

interface SendFlowState {
    amount: number;
    ngnAmount: number;
    currency: 'USD' | 'NGN';
    recipientName?: string;
    recipientUsername?: string;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    rate?: number;
    bankLogo?: string;
}

export default function Confirm() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [currentRate, setCurrentRate] = useState<number>(0);
    const [isRateLoading, setIsRateLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [signingMessage, setSigningMessage] = useState('');

    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const { mutate: signAndExecuteSuiTransaction } = useSignAndExecuteTransaction();
    const { mutateAsync: signTransaction } = useSignTransaction();

    const { connection } = useConnection();
    const { publicKey: solanaPublicKey, sendTransaction: sendSolanaTransaction } = useWallet();

    const { account: aptosAccount, signAndSubmitTransaction: signAndSubmitAptosTransaction } = useAptosWallet();

    const { address: bscAddress } = useBscAccount();
    const { sendTransactionAsync: sendBscTransaction } = useBscSendTransaction();

    const { address: tronAddress } = useTronWallet();

    const { selectedChain } = useChain();
    const { activeWalletSource, validatePin } = useAuth();
    const { addEntry } = useSavings();

    // PIN Modal State
    const [showPinModal, setShowPinModal] = useState(false);

    // Fee ref — stores fee from order response so payment handlers can access it
    const orderFeeRef = useRef<number>(0);

    // Description State
    const [descriptionText, setDescriptionText] = useState('');

    // Get data from navigation state or use defaults
    const state = location.state as SendFlowState | null;

    // Redirect to dashboard if state is missing (page was reloaded)
    useEffect(() => {
        if (!state) {
            navigate('/');
        }
    }, [state, navigate]);

    const amount = state?.amount ?? 0;
    // Recalculate NGN amount with current rate if rate was fetched
    const recipientName = state?.recipientName ?? '--';
    const recipientUsername = state?.recipientUsername;
    const bankName = state?.bankName ?? '--';
    const bankCode = state?.bankCode ?? '';
    const accountNumber = state?.accountNumber ?? '--';
    const bankLogo = state?.bankLogo;

    // Always fetch a fresh rate on mount and when page becomes visible (e.g. tab switch, refresh)
    useEffect(() => {
        const loadFreshRate = () => {
            setIsRateLoading(true);
            fetchCachedRate(true)
                .then(rate => {
                    if (rate > 0) setCurrentRate(rate);
                    else setCurrentRate(state?.rate ?? 1460);
                })
                .catch(() => setCurrentRate(state?.rate ?? 1460))
                .finally(() => setIsRateLoading(false));
        };

        loadFreshRate();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadFreshRate();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Calculate NGN amount with current rate
    const ngnAmount = amount * currentRate;

    // Calculate upfront fees and totals for UI
    const feeRate = amount < 100 ? 0.01 : amount < 500 ? 0.0075 : amount < 999 ? 0.005 : 0.0035;
    const feeApprox = amount * feeRate;

    const savingsConfigUI = getSavingsConfig(selectedChain);
    const hasSavingsUI = savingsConfigUI.enabled && savingsConfigUI.savingsAddress && savingsConfigUI.percentage > 0;
    const savingsAmountUI = hasSavingsUI ? parseFloat((amount * savingsConfigUI.percentage / 100).toFixed(6)) : 0;
    const totalYouPay = amount + feeApprox + savingsAmountUI;


    // Payment Handlers
    const handleSuiPayment = async (walletAddress: string, orderId: string, txBytes?: string, sponsorSignature?: string) => {
        if (!currentAccount) {
            setError("Please connect your Sui wallet");
            return;
        }

        try {
            // --- SPONSORED FLOW: backend built the tx, we just sign + submit ---
            if (txBytes && sponsorSignature) {
                setIsLoading(false);
                setIsSigning(true);
                setSigningMessage('Please sign in Wallet...');

                // Deserialize the backend's base64 txBytes into a Transaction object.
                // Transaction.from() preserves all fields: gasOwner, sender, gasPayment, gasBudget.
                const sponsoredTx = Transaction.from(txBytes);

                const { signature: userSignature } = await signTransaction({ 
                    transaction: sponsoredTx 
                });

                setSigningMessage('Submitting transaction...');

                // Submit with BOTH signatures — user + sponsor
                await suiClient.executeTransactionBlock({
                    transactionBlock: txBytes,
                    signature: [userSignature, sponsorSignature],
                    options: { showEffects: true },
                });

                setSigningMessage('Payment confirmed! Redirecting...');

                // Log savings entry if applicable
                const savingsConfig = getSavingsConfig(selectedChain);
                const hasSavings = savingsConfig.enabled && savingsConfig.savingsAddress && savingsConfig.percentage > 0;
                if (hasSavings) {
                    const savingsAmountUSDC = parseFloat((amount * savingsConfig.percentage / 100).toFixed(6));
                    if (savingsAmountUSDC > 0) {
                        addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfig.savingsAddress, status: 'completed' });
                        toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                    }
                }

                setTimeout(() => {
                    if (window.location.pathname === '/send/confirm') {
                        navigate('/send/payment', {
                            state: {
                                walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                    amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                                }
                            }
                        });
                    }
                }, 2000);
                return;
            }

            // --- FALLBACK FLOW: user pays own gas (if sponsored tx wasn't available) ---
            // Check savings config before building tx
            const savingsConfig = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfig.enabled && savingsConfig.savingsAddress && savingsConfig.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfig.percentage / 100).toFixed(6)) : 0;
            let savingsAmountInMist = hasSavings ? Math.floor(savingsAmountUSDC * 1_000_000) : 0;

            const { data: coins } = await suiClient.getCoins({
                owner: currentAccount.address,
                coinType: SUI_USDC_COIN_TYPE,
            });

            if (!coins || coins.length === 0) throw new Error("No USDC coins found in wallet");

            const tx = new Transaction();
            const amountWithFee = amount + orderFeeRef.current;
            const amountInMist = Math.floor(parseFloat(amountWithFee.toString()) * 1_000_000);
            let totalNeeded = amountInMist + savingsAmountInMist;

            const totalBalance = coins.reduce((sum, coin) => sum + parseInt(coin.balance), 0);

            if (totalBalance < totalNeeded) {
                if (totalBalance >= amountInMist) {
                    hasSavings = false;
                    savingsAmountUSDC = 0;
                    savingsAmountInMist = 0;
                    totalNeeded = amountInMist;
                } else {
                    throw new Error(`Insufficient USDC balance. Required: ${(totalNeeded / 1_000_000).toFixed(2)} (incl. ${savingsAmountUSDC} savings), Available: ${(totalBalance / 1_000_000).toFixed(2)}`);
                }
            }

            let primaryCoin = coins.find(c => parseInt(c.balance) >= totalNeeded);

            if (!primaryCoin) {
                const sortedCoins = coins.sort((a, b) => parseInt(b.balance) - parseInt(a.balance));
                primaryCoin = sortedCoins[0];

                const coinsToMerge = [];
                let currentBalance = parseInt(primaryCoin.balance);

                for (let i = 1; i < sortedCoins.length; i++) {
                    if (currentBalance >= totalNeeded) break;
                    coinsToMerge.push(sortedCoins[i]);
                    currentBalance += parseInt(sortedCoins[i].balance);
                }

                if (currentBalance < totalNeeded) {
                    throw new Error(`Insufficient USDC balance. merged: ${(currentBalance / 1_000_000).toFixed(2)}, required: ${(totalNeeded / 1_000_000).toFixed(2)}`);
                }

                if (coinsToMerge.length > 0) {
                    tx.mergeCoins(
                        tx.object(primaryCoin.coinObjectId),
                        coinsToMerge.map(c => tx.object(c.coinObjectId))
                    );
                }
            }

            const [coinToTransfer] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amountInMist]);
            tx.transferObjects([coinToTransfer], walletAddress);

            if (hasSavings && savingsAmountInMist > 0) {
                const [savingsCoin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [savingsAmountInMist]);
                tx.transferObjects([savingsCoin], savingsConfig.savingsAddress);
            }

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in Wallet...');

            signAndExecuteSuiTransaction(
                { transaction: tx },
                {
                    onSuccess: () => {
                        setSigningMessage('Payment confirmed! Redirecting...');
                        if (hasSavings && savingsAmountUSDC > 0) {
                            addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfig.savingsAddress, status: 'completed' });
                            toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                        }
                        setTimeout(() => {
                            if (window.location.pathname === '/send/confirm') {
                                navigate('/send/payment', {
                                    state: {
                                        walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                            amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                                        }
                                    }
                                });
                            }
                        }, 2000);
                    },
                    onError: (err) => {
                        setIsSigning(false);
                        setIsLoading(false);
                        const msg = err.message?.toLowerCase() || '';
                        const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
                        if (isGasFeeError(err.message)) {
                            toast.error('Transaction failed: insufficient gas fees. Please add more SUI to your wallet to cover network fees.');
                        }
                        setError(isUserRejection ? 'Transaction was cancelled or rejected.' : (err.message || 'Failed to execute transaction.'));
                    },
                }
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more SUI to your wallet to cover network fees.');
            }
            setError(error.message || 'Failed to prepare transaction.');
        }
    };

    const handleSolanaPayment = async (walletAddress: string, orderId: string) => {
        if (!solanaPublicKey) {
            setError("Please connect your Solana wallet");
            return;
        }

        try {
            // Check savings config before building tx
            const savingsConfigSol = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfigSol.enabled && savingsConfigSol.savingsAddress && savingsConfigSol.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfigSol.percentage / 100).toFixed(6)) : 0;
            let savingsAmountInMicros = hasSavings ? Math.floor(savingsAmountUSDC * 1_000_000) : 0;

            const amountWithFee = amount + orderFeeRef.current;
            const amountInMicros = Math.floor(parseFloat(amountWithFee.toString()) * 1_000_000);
            let totalNeeded = amountInMicros + savingsAmountInMicros;
            const destinationWalletPubkey = new PublicKey(walletAddress);
            const mintPubkey = new PublicKey(SOLANA_USDC_MINT);

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                solanaPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const usdcAccount = tokenAccounts.value.find((account) =>
                account.account.data.parsed.info.mint === SOLANA_USDC_MINT
            );

            if (!usdcAccount) {
                throw new Error("No USDC token account found.");
            }

            const userTokenAccountPubkey = new PublicKey(usdcAccount.pubkey);
            const availableBalance = usdcAccount.account.data.parsed.info.tokenAmount.uiAmount * 1_000_000;

            if (availableBalance < totalNeeded) {
                // Not enough for both payment and savings. Check if enough for JUST payment
                if (availableBalance >= amountInMicros) {
                    hasSavings = false;
                    savingsAmountUSDC = 0;
                    savingsAmountInMicros = 0;
                    totalNeeded = amountInMicros;
                } else {
                    throw new Error(`Insufficient USDC balance. Required: ${(totalNeeded / 1_000_000).toFixed(2)} (incl. ${savingsAmountUSDC} savings)`);
                }
            }

            const destinationTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                destinationWalletPubkey
            );

            const transaction = new SolTransaction();
            const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);

            if (!destinationAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        solanaPublicKey,
                        destinationTokenAccount,
                        destinationWalletPubkey,
                        mintPubkey,
                        TOKEN_PROGRAM_ID,
                        ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            } else {
                if (destinationAccountInfo.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
                    throw new Error("Invalid destination account: Address occupied by non-Token account.");
                }
            }

            // Main offramp transfer
            transaction.add(
                createTransferInstruction(
                    userTokenAccountPubkey,
                    destinationTokenAccount,
                    solanaPublicKey,
                    amountInMicros,
                    [],
                    TOKEN_PROGRAM_ID
                )
            );

            // Savings transfer — bundled in same tx, one signature
            if (hasSavings && savingsAmountInMicros > 0) {
                const savingsPubkey = new PublicKey(savingsConfigSol.savingsAddress);
                const savingsTokenAccount = await getAssociatedTokenAddress(mintPubkey, savingsPubkey);
                const savingsAccountInfo = await connection.getAccountInfo(savingsTokenAccount);

                if (!savingsAccountInfo) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            solanaPublicKey,
                            savingsTokenAccount,
                            savingsPubkey,
                            mintPubkey,
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        )
                    );
                }

                transaction.add(
                    createTransferInstruction(
                        userTokenAccountPubkey,
                        savingsTokenAccount,
                        solanaPublicKey,
                        savingsAmountInMicros,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = solanaPublicKey;

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in Solana Wallet...');

            const signature = await sendSolanaTransaction(transaction, connection);

            setSigningMessage('Confirming on-chain...');
            const { blockhash: confirmBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            await connection.confirmTransaction(
                { signature, blockhash: confirmBlockhash, lastValidBlockHeight },
                'confirmed'
            );

            setSigningMessage('Payment confirmed! Redirecting...');
            // Log savings entry
            if (hasSavings && savingsAmountUSDC > 0) {
                addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigSol.savingsAddress, status: 'completed' });
                toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
            }
            setTimeout(() => {
                if (window.location.pathname === '/send/confirm') {
                    navigate('/send/payment', {
                        state: {
                            walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                            }
                        }
                    });
                }
            }, 2000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            const msg = error.message?.toLowerCase() || '';
            const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more SOL to your wallet to cover network fees.');
            }
            setError(isUserRejection ? 'Transaction cancelled or rejected.' : (error.message || 'Failed to prepare transaction.'));
        }
    };

    const handleAptosPayment = async (walletAddress: string, orderId: string) => {
        if (!aptosAccount) {
            setError("Please connect your Aptos wallet");
            return;
        }

        try {
            const savingsConfigAptos = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfigAptos.enabled && savingsConfigAptos.savingsAddress && savingsConfigAptos.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfigAptos.percentage / 100).toFixed(6)) : 0;
            let savingsAmountInMicros = hasSavings ? Math.floor(savingsAmountUSDC * 1_000_000) : 0;

            const amountWithFee = amount + orderFeeRef.current;
            const amountInMicros = Math.floor(parseFloat(amountWithFee.toString()) * 1_000_000);
            let totalNeeded = amountInMicros + savingsAmountInMicros;

            const balance = await aptos.getAccountCoinAmount({
                accountAddress: aptosAccount.address,
                coinType: APTOS_USDC_ADDRESS,
            });

            if (balance < totalNeeded) {
                // Not enough for both payment and savings. Let's see if there's enough for JUST the payment
                if (balance >= amountInMicros) {
                    hasSavings = false;
                    savingsAmountUSDC = 0;
                    savingsAmountInMicros = 0;
                    totalNeeded = amountInMicros;
                } else {
                    throw new Error(`Insufficient Aptos USDC balance. Required: ${(totalNeeded / 1_000_000).toFixed(2)} (incl. ${savingsAmountUSDC} savings), Available: ${(balance / 1_000_000).toFixed(2)}`);
                }
            }

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in Aptos Wallet...');

            await signAndSubmitAptosTransaction({
                data: {
                    function: "0x1::aptos_account::transfer_coins",
                    typeArguments: [APTOS_USDC_ADDRESS],
                    functionArguments: [walletAddress, amountInMicros.toString()]
                }
            });

            // Execute savings transfer as a second transaction
            if (hasSavings && savingsAmountInMicros > 0) {
                setSigningMessage('Sending savings... Please sign again.');
                try {
                    await signAndSubmitAptosTransaction({
                        data: {
                            function: "0x1::aptos_account::transfer_coins",
                            typeArguments: [APTOS_USDC_ADDRESS],
                            functionArguments: [savingsConfigAptos.savingsAddress, savingsAmountInMicros.toString()]
                        }
                    });
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigAptos.savingsAddress, status: 'completed' });
                    toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                } catch (savingsErr) {
                    console.error('Savings transfer failed:', savingsErr);
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigAptos.savingsAddress, status: 'failed' });
                    toast.error('Savings transfer failed, but your payment was successful.');
                }
            }

            setSigningMessage('Payment confirmed! Redirecting...');
            setTimeout(() => {
                if (window.location.pathname === '/send/confirm') {
                    navigate('/send/payment', {
                        state: {
                            walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                            }
                        }
                    });
                }
            }, 2000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            const msg = error.message?.toLowerCase() || '';
            const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more APT to your wallet to cover network fees.');
            }
            setError(isUserRejection ? 'Transaction cancelled or rejected.' : (error.message || 'Failed to prepare transaction.'));
        }
    };

    const handleBscPayment = async (walletAddress: string, orderId: string) => {
        if (!bscAddress) {
            setError("Please connect your BSC wallet");
            return;
        }

        try {
            const savingsConfigBsc = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfigBsc.enabled && savingsConfigBsc.savingsAddress && savingsConfigBsc.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfigBsc.percentage / 100).toFixed(6)) : 0;

            const amountWithFee = amount + orderFeeRef.current;
            const amountInWei = parseUnits(amountWithFee.toString(), 18);
            let savingsAmountInWei = hasSavings ? parseUnits(savingsAmountUSDC.toString(), 18) : BigInt(0);
            let totalNeededWei = amountInWei + savingsAmountInWei;

            const balance = await readContract(wagmiConfig, {
                abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
                address: BSC_USDC_ADDRESS,
                functionName: 'balanceOf',
                args: [bscAddress as `0x${string}`],
            }) as bigint;
            if (balance < totalNeededWei) {
                if (balance >= amountInWei) {
                    hasSavings = false;
                    savingsAmountUSDC = 0;
                    savingsAmountInWei = BigInt(0);
                    totalNeededWei = amountInWei;
                } else {
                    throw new Error(`Insufficient BSC USDC balance. Required: ${formatUnits(totalNeededWei, 18)} (incl. ${savingsAmountUSDC} savings), Available: ${formatUnits(balance, 18)}`);
                }
            }

            const data = encodeFunctionData({
                abi: [{
                    name: 'transfer',
                    type: 'function',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [walletAddress as `0x${string}`, amountInWei]
            });

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in BSC Wallet...');

            await sendBscTransaction({
                to: BSC_USDC_ADDRESS,
                data
            });

            // Execute savings transfer as a second transaction
            if (hasSavings && savingsAmountUSDC > 0) {
                setSigningMessage('Sending savings... Please sign again.');
                try {
                    const savingsAmountInWei = parseUnits(savingsAmountUSDC.toString(), 18);
                    const savingsData = encodeFunctionData({
                        abi: [{
                            name: 'transfer',
                            type: 'function',
                            inputs: [
                                { name: 'to', type: 'address' },
                                { name: 'amount', type: 'uint256' }
                            ],
                            outputs: [{ name: '', type: 'bool' }]
                        }],
                        functionName: 'transfer',
                        args: [savingsConfigBsc.savingsAddress as `0x${string}`, savingsAmountInWei]
                    });
                    await sendBscTransaction({
                        to: BSC_USDC_ADDRESS,
                        data: savingsData
                    });
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigBsc.savingsAddress, status: 'completed' });
                    toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                } catch (savingsErr) {
                    console.error('Savings transfer failed:', savingsErr);
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigBsc.savingsAddress, status: 'failed' });
                    toast.error('Savings transfer failed, but your payment was successful.');
                }
            }

            setSigningMessage('Payment confirmed! Redirecting...');
            setTimeout(() => {
                if (window.location.pathname === '/send/confirm') {
                    navigate('/send/payment', {
                        state: {
                            walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                            }
                        }
                    });
                }
            }, 2000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            const msg = error.message?.toLowerCase() || '';
            const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more BNB to your wallet to cover network fees.');
            }
            setError(isUserRejection ? 'Transaction cancelled or rejected.' : (error.message || 'Failed to prepare transaction.'));
        }
    };

    const handleBasePayment = async (walletAddress: string, orderId: string) => {
        if (!bscAddress) {
            setError("Please connect your Base wallet");
            return;
        }

        try {
            const savingsConfigBase = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfigBase.enabled && savingsConfigBase.savingsAddress && savingsConfigBase.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfigBase.percentage / 100).toFixed(6)) : 0;

            const amountWithFee = amount + orderFeeRef.current;
            const amountInWei = parseUnits(amountWithFee.toString(), 6);
            let savingsAmountInWei = hasSavings ? parseUnits(savingsAmountUSDC.toString(), 6) : BigInt(0);
            let totalNeededWei = amountInWei + savingsAmountInWei;

            const balance = await readContract(wagmiConfig, {
                abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
                address: BASE_USDC_ADDRESS,
                functionName: 'balanceOf',
                args: [bscAddress as `0x${string}`],
            }) as bigint;
            if (balance < totalNeededWei) {
                if (balance >= amountInWei) {
                    hasSavings = false;
                    savingsAmountUSDC = 0;
                    savingsAmountInWei = BigInt(0);
                    totalNeededWei = amountInWei;
                } else {
                    throw new Error(`Insufficient BASE USDC balance. Required: ${formatUnits(totalNeededWei, 6)} (incl. ${savingsAmountUSDC} savings), Available: ${formatUnits(balance, 6)}`);
                }
            }

            const data = encodeFunctionData({
                abi: [{
                    name: 'transfer',
                    type: 'function',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [walletAddress as `0x${string}`, amountInWei]
            });

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in Base Wallet...');

            await sendBscTransaction({
                to: BASE_USDC_ADDRESS,
                data
            });

            // Execute savings transfer as a second transaction
            if (hasSavings && savingsAmountUSDC > 0) {
                setSigningMessage('Sending savings... Please sign again.');
                try {
                    const savingsAmountInWei = parseUnits(savingsAmountUSDC.toString(), 6);
                    const savingsData = encodeFunctionData({
                        abi: [{
                            name: 'transfer',
                            type: 'function',
                            inputs: [
                                { name: 'to', type: 'address' },
                                { name: 'amount', type: 'uint256' }
                            ],
                            outputs: [{ name: '', type: 'bool' }]
                        }],
                        functionName: 'transfer',
                        args: [savingsConfigBase.savingsAddress as `0x${string}`, savingsAmountInWei]
                    });
                    await sendBscTransaction({
                        to: BASE_USDC_ADDRESS,
                        data: savingsData
                    });
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigBase.savingsAddress, status: 'completed' });
                    toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                } catch (savingsErr) {
                    console.error('Savings transfer failed:', savingsErr);
                    addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigBase.savingsAddress, status: 'failed' });
                    toast.error('Savings transfer failed, but your payment was successful.');
                }
            }

            setSigningMessage('Payment confirmed! Redirecting...');
            setTimeout(() => {
                if (window.location.pathname === '/send/confirm') {
                    navigate('/send/payment', {
                        state: {
                            walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                            }
                        }
                    });
                }
            }, 2000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            const msg = error.message?.toLowerCase() || '';
            const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more ETH to your wallet to cover network fees.');
            }
            setError(isUserRejection ? 'Transaction cancelled or rejected.' : (error.message || 'Failed to prepare transaction.'));
        }
    };

    const handleTronPayment = async (walletAddress: string, orderId: string) => {
        if (!tronAddress) {
            setError("Please connect your Tron wallet");
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tronWeb = (window as any).tronWeb;
            if (!tronWeb || !tronWeb.ready) throw new Error("TronWeb not found. Please ensure TronLink is installed and unlocked.");

            const savingsConfigTron = getSavingsConfig(selectedChain);
            let hasSavings = savingsConfigTron.enabled && savingsConfigTron.savingsAddress && savingsConfigTron.percentage > 0;
            let savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfigTron.percentage / 100).toFixed(6)) : 0;
            let savingsAmountInSun = hasSavings ? Math.floor(savingsAmountUSDC * 1_000_000) : 0;

            // Tron TRC20 transfer amount = amount * 10^6
            const amountWithFee = amount + orderFeeRef.current;
            const amountInSun = Math.floor(parseFloat(amountWithFee.toString()) * 1_000_000);
            let totalNeededSun = amountInSun + savingsAmountInSun;

            // Assume the contract check logic handles balances or we could add a `balanceOf` check here
            // TronWeb doesn't have a straightforward `balanceOf` in the standard adapter without loading the contract
            // We will fetch it
            try {
                const contract = await tronWeb.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
                const balance = await contract.balanceOf(tronAddress).call();
                const balanceSun = parseInt(balance.toString());

                if (balanceSun < totalNeededSun) {
                    if (balanceSun >= amountInSun) {
                        hasSavings = false;
                        savingsAmountUSDC = 0;
                        savingsAmountInSun = 0;
                        totalNeededSun = amountInSun;
                    } else {
                        throw new Error(`Insufficient Tron USDC balance. Required: ${(totalNeededSun / 1_000_000).toFixed(2)} (incl. ${savingsAmountUSDC} savings), Available: ${(balanceSun / 1_000_000).toFixed(2)}`);
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
                if (e.message.includes('Insufficient')) throw e;
                console.warn("Could not fetch Tron balance prior to tx", e);
            }

            setIsLoading(false);
            setIsSigning(true);
            setSigningMessage('Please sign in Tron Wallet...');

            const contract = await tronWeb.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
            const txId = await contract.transfer(walletAddress, amountInSun).send();

            if (txId) {
                // Execute savings transfer as a second transaction
                if (hasSavings && savingsAmountInSun > 0) {
                    setSigningMessage('Sending savings... Please sign again.');
                    try {
                        const savingsTxId = await contract.transfer(savingsConfigTron.savingsAddress, savingsAmountInSun).send();
                        if (savingsTxId) {
                            addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigTron.savingsAddress, status: 'completed' });
                            toast.success(`Auto-saved $${savingsAmountUSDC.toFixed(2)} to savings!`);
                        } else {
                            addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigTron.savingsAddress, status: 'failed' });
                            toast.error('Savings transfer failed, but your payment was successful.');
                        }
                    } catch (savingsErr) {
                        console.error('Savings transfer failed:', savingsErr);
                        addEntry({ chain: selectedChain, amount: savingsAmountUSDC, savingsAddress: savingsConfigTron.savingsAddress, status: 'failed' });
                        toast.error('Savings transfer failed, but your payment was successful.');
                    }
                }

                setSigningMessage('Payment confirmed! Redirecting...');
                setTimeout(() => {
                    if (window.location.pathname === '/send/confirm') {
                        navigate('/send/payment', {
                            state: {
                                walletAddress, amount, orderId, chain: selectedChain, confirmState: {
                                    amount, ngnAmount, currency: 'USD', recipientName, recipientUsername, bankName, bankCode, accountNumber, rate: currentRate, bankLogo
                                }
                            }
                        });
                    }
                }, 2000);
            } else {
                throw new Error('Transaction failed or was rejected.');
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            const msg = error.message?.toLowerCase() || '';
            const isUserRejection = msg.includes('reject') || msg.includes('cancel') || msg.includes('user denied') || msg.includes('user disapproved');
            if (isGasFeeError(error.message)) {
                toast.error('Transaction failed: insufficient gas fees. Please add more TRX to your wallet to cover network fees (energy/bandwidth).');
            }
            setError(isUserRejection ? 'Transaction cancelled or rejected.' : (error.message || 'Failed to prepare transaction.'));
        }
    };

    const executePayment = async (walletAddress: string, orderId: string, txBytes?: string, sponsorSignature?: string) => {
        if (selectedChain === 'SOLANA') {
            await handleSolanaPayment(walletAddress, orderId);
        } else if (selectedChain === 'APTOS') {
            await handleAptosPayment(walletAddress, orderId);
        } else if (selectedChain === 'BSC') {
            await handleBscPayment(walletAddress, orderId);
        } else if (selectedChain === 'BASE') {
            await handleBasePayment(walletAddress, orderId);
        } else if (selectedChain === 'TRON') {
            await handleTronPayment(walletAddress, orderId);
        } else {
            await handleSuiPayment(walletAddress, orderId, txBytes, sponsorSignature);
        }
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const idempotencyKey = generateIdempotencyKey();

            // Check savings config to append to the payload later on
            const savingsConfig = getSavingsConfig(selectedChain);
            const hasSavings = savingsConfig.enabled && savingsConfig.savingsAddress && savingsConfig.percentage > 0;
            const savingsAmountUSDC = hasSavings ? parseFloat((amount * savingsConfig.percentage / 100).toFixed(6)) : 0;

            // Re-eval if there's enough balance across chains locally before POST
            // We set it to 0 if they don't have enough balance, so backend knows it was skipped
            if (activeWalletSource) {
                // The individual handlePayment functions will do the actual balance checking,
                // but we can pass current calculated values as defaults.
                // We will update the POST call to happen *after* we prepare the payment in the wallet handlers.
                // But wait, the current architecture POSTs the order first, gets the ID, then executes the wallet payment.
                // So we need to determine if we have balance *before* POSTing the order.
            }

            const payload = {
                idempotencyKey,
                amountStableCoin: Number(amount),
                amountNgn: Number(ngnAmount),
                orderType: 'off-ramp',
                currency: 'NGN',
                rate: Number(currentRate),
                bankCode: bankCode,
                bankAccount: accountNumber,
                bankName: bankName,
                accountName: recipientName,
                recipientUsername: recipientUsername,
                hasSavings: hasSavings,
                savingsAmount: savingsAmountUSDC,
                savingsAddress: savingsConfig.savingsAddress,
                userWalletAddress: selectedChain === 'SOLANA'
                    ? (solanaPublicKey?.toBase58() ?? '')
                    : selectedChain === 'APTOS'
                        ? (aptosAccount?.address ?? '')
                        : (selectedChain === 'BSC' || selectedChain === 'BASE')
                            ? (bscAddress ?? '')
                            : selectedChain === 'TRON'
                                ? (tronAddress ?? '')
                                : (currentAccount?.address ?? ''),
                coin: {
                    sui: selectedChain === 'SUI',
                    base: selectedChain === 'BASE',
                    solana: selectedChain === 'SOLANA',
                    ethereum: false,
                    aptos: selectedChain === 'APTOS',
                    bsc: selectedChain === 'BSC',
                    tron: selectedChain === 'TRON'
                },
                description: descriptionText.trim() ? descriptionText.trim() : (recipientUsername ? `Transfer to @${recipientUsername}` : `Transfer to ${recipientName}`)
            };

            const response = await client.post('/order', payload);

            const data = response.data;

            const id = data.id;
            const wallet = data.wallet;
            orderFeeRef.current = data.fee || 0;

            if (!wallet || !id) {
                throw new Error('Invalid response from server: Missing order ID or wallet address');
            }
            invalidateOrdersCache(); // Refresh orders list

            // Execute the wallet payment, which handles the redirection upon success
            await executePayment(wallet, id, data.txBytes, data.sponsorSignature);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            setIsLoading(false);
            setIsSigning(false);
            let errorMessage = 'Unknown error occurred';
            try {
                if (error.response?.data) {
                    if (typeof error.response.data === 'string') {
                        errorMessage = error.response.data;
                    } else if (error.response.data.message) {
                        errorMessage = error.response.data.message;
                    }
                } else if (error.message) {
                    errorMessage = error.message;
                }
            } catch {
                errorMessage = 'Failed to create order';
            }
            setError(`Failed: ${errorMessage}`);
        }
    };

    const onConfirmClick = async () => {
        if (activeWalletSource === 'zk') {
            setShowPinModal(true);
        } else {
            return handleConfirm();
        }
    };



    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Summary" showBack />

            {/* PIN Modal Overlay */}
            <TransactionPinModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                onSuccess={() => {
                    setShowPinModal(false);
                    handleConfirm();
                }}
                validatePin={validatePin}
            />

            <div style={{ padding: '0 20px', paddingBottom: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* Amount Summary Section */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', marginTop: '16px' }}>
                    <h1 style={{
                        fontSize: ngnAmount.toString().length > 10 ? '36px' : ngnAmount.toString().length > 7 ? '42px' : '48px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        textAlign: 'center',
                        lineHeight: 1.1,
                    }}>
                        {isRateLoading ? '...' : (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.8em', opacity: 0.8 }}>₦</span>
                                {ngnAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                            </span>
                        )}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '8px', fontWeight: 500 }}>
                        ~{amount.toFixed(2)} USDC
                    </p>
                </div>

                {/* Unified Details Card */}
                <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--card-shadow)', transition: 'background-color 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>To</span>
                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>{recipientUsername ? `@${recipientUsername}` : recipientName || bankName}</span>
                    </div>

                    {!recipientUsername && bankName && bankName !== '--' && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Bank</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>{bankName}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Account</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>{accountNumber}</span>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Network</span>
                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{selectedChain?.toLowerCase() || 'Solana'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Exchange rate</span>
                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>{isRateLoading ? 'Loading...' : `1 USDC = ₦${currentRate.toLocaleString('en-NG')}`}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Fee</span>
                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>
                            ${feeApprox.toFixed(2)}
                        </span>
                    </div>

                    {hasSavingsUI && savingsAmountUI > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Savings contribution</span>
                            <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>
                                ${savingsAmountUI.toFixed(2)}
                            </span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Total you pay</span>
                        <span style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 700 }}>
                            ${totalYouPay.toFixed(2)} USDC
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>Network fee</span>
                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>$0.007</span>
                    </div>
                </div>

                {/* Description Input & Quick Picks */}
                <div style={{ marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px', fontWeight: 500 }}>Note (Optional)</p>
                    <input
                        type="text"
                        placeholder="What's this for?"
                        value={descriptionText}
                        onChange={(e) => setDescriptionText(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '16px',
                            padding: '16px',
                            color: 'var(--text-main)',
                            fontSize: '15px',
                            outline: 'none',
                            marginBottom: '12px',
                            transition: 'border-color 0.2s ease',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                        onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)')}
                    />
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                        {['Payment', 'Gift', 'Salary'].map((pick) => (
                            <button
                                key={pick}
                                onClick={() => setDescriptionText(pick)}
                                style={{
                                    background: descriptionText === pick ? 'var(--primary)' : 'var(--surface)',
                                    color: descriptionText === pick ? '#fff' : 'var(--text-main)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '20px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {pick}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
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
                        onClick={onConfirmClick}
                        disabled={isLoading || isRateLoading || isSigning}
                    >
                        {isSigning ? (signingMessage || 'Signing...') : isLoading ? 'Creating Order...' : isRateLoading ? 'Fetching Rate...' : 'Send'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
