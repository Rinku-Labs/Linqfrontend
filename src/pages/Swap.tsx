import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDown, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import FeatureExplainerModal from '../components/FeatureExplainerModal';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getQuote, type Token, type QuoteResponse, getSwapStatus } from '../api/swap';
import { playSuccessSound } from '../utils/audio';
import { getAllCoins } from '../utils/suiCoins';
import tokenData from '../data/tokens.json';

// Wallet hooks
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction as SolTransaction, SystemProgram } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount as useEvmAccount, useSendTransaction, useBalance, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import { ConnectButton as SuiConnectButton } from '@mysten/dapp-kit';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import usdcLogo from '../assets/usdc-logo.png';
import suiLogo from '../assets/sui-logo.png';
import solanaLogo from '../assets/solana-logo.png';
import aptosLogo from '../assets/aptos-logo.png';
import bnbLogo from '../assets/bnb-logo.png';
import tronLogo from '../assets/tron-logo.png';

export default function Swap() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const suiClient = useSuiClient();

    // State
    const [tokens, setTokens] = useState<Token[]>([]);
    // const [loadingTokens, setLoadingTokens] = useState(true);

    const [sourceChain, setSourceChain] = useState<string>('SOLANA');
    const [destChain, setDestChain] = useState<string>('SUI');
    const [sourceToken, setSourceToken] = useState<Token | null>(null);
    const [destToken, setDestToken] = useState<Token | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [swapFinalDetails, setSwapFinalDetails] = useState<any>(null);

    const [status, setStatus] = useState<'idle' | 'swapping' | 'success' | 'failed'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [balance, setBalance] = useState<string>('0');

    // Recipient State
    const [recipient, setRecipient] = useState('');
    const [isRecipientValid, setIsRecipientValid] = useState(true);

    const validateAddress = (address: string, chain: string) => {
        if (!address) return false;
        switch (chain) {
            case 'SOLANA': return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
            case 'SUI': return /^0x[a-fA-F0-9]{64}$/.test(address); // Sui addresses are 32 bytes (64 hex chars)
            case 'APTOS': return /^0x[a-fA-F0-9]{64,66}$/.test(address);
            case 'BSC':
            case 'BASE': return /^0x[a-fA-F0-9]{40}$/.test(address);
            case 'TRON': return /^T[a-zA-Z0-9]{33}$/.test(address);
            default: return true;
        }
    };

    useEffect(() => {
        setIsRecipientValid(validateAddress(recipient, destChain));
    }, [recipient, destChain]);

    // Wallet State
    const suiAccount = useCurrentAccount();

    const { mutate: signAndExecuteSui } = useSignAndExecuteTransaction();

    const { publicKey: solanaPublicKey, sendTransaction: sendSolanaTransaction } = useSolanaWallet();
    const { connection } = useConnection();

    const { account: aptosAccount, signAndSubmitTransaction: signAndSubmitAptos } = useAptosWallet();

    const { address: evmAddress } = useEvmAccount();
    const { sendTransactionAsync: sendEvmTransaction } = useSendTransaction();
    const { writeContractAsync } = useWriteContract();

    const { address: tronAddress } = useTronWallet();

    const isEvmChain = sourceChain === 'BSC' || sourceChain === 'BASE';
    const targetChainId = sourceChain === 'BSC' ? 56 : (sourceChain === 'BASE' ? 8453 : undefined);

    const isNativeToken = sourceToken?.symbol === 'ETH' || (sourceToken?.symbol === 'BNB' && sourceChain === 'BSC');
    const tokenAddress = !isNativeToken && sourceToken?.contractAddress ? (sourceToken.contractAddress as `0x${string}`) : undefined;

    // Native Balance (ETH/BNB)
    const { data: nativeBalance } = useBalance({
        address: evmAddress,
        chainId: targetChainId,
        query: {
            enabled: !!evmAddress && isEvmChain && isNativeToken
        }
    });

    // ERC20 Token Balance
    const erc20BalanceAbi = parseAbi([
        'function balanceOf(address owner) view returns (uint256)'
    ]);

    const { data: tokenBalance } = useReadContract({
        address: tokenAddress,
        abi: erc20BalanceAbi,
        functionName: 'balanceOf',
        args: evmAddress ? [evmAddress] : undefined,
        chainId: targetChainId,
        query: {
            enabled: !!evmAddress && isEvmChain && !!tokenAddress
        }
    });

    // Load Tokens
    useEffect(() => {
        setTokens(tokenData as unknown as Token[]);
        // Set defaults from local data
        const solUsdc = tokenData.find(t => t.symbol === 'USDC' && t.blockchain === 'sol');
        const suiUsdc = tokenData.find(t => t.symbol === 'USDC' && t.blockchain === 'sui');
        if (solUsdc) setSourceToken(solUsdc as unknown as Token);
        if (suiUsdc) setDestToken(suiUsdc as unknown as Token);
    }, []);

    // Reset/Default Source Token when Chain Changes
    useEffect(() => {
        if (tokens.length > 0) {
            const chainId = sourceChain === 'SOLANA' ? 'sol' : sourceChain.toLowerCase();
            const defaultToken = tokens.find(t => t.blockchain === chainId && t.symbol === 'USDC');
            setSourceToken(defaultToken || null);
        }
    }, [sourceChain, tokens]);

    // Reset/Default Destination Token when Chain Changes
    useEffect(() => {
        if (tokens.length > 0) {
            const chainId = destChain === 'SOLANA' ? 'sol' : destChain.toLowerCase();
            const defaultToken = tokens.find(t => t.blockchain === chainId && t.symbol === 'USDC');
            setDestToken(defaultToken || null);
        }
    }, [destChain, tokens]);

    // Fetch Balance
    useEffect(() => {
        const fetchBalance = async () => {
            if (!sourceToken || !sourceChain) {
                setBalance('0');
                return;
            }

            try {
                if (sourceChain === 'SOLANA') {
                    if (!solanaPublicKey) { setBalance('0'); return; }
                    if (sourceToken.symbol === 'SOL') {
                        const bal = await connection.getBalance(solanaPublicKey);
                        setBalance((bal / 1e9).toString());
                    } else {
                        // SPL Token
                        const mint = new PublicKey(sourceToken.contractAddress!);
                        const ata = await getAssociatedTokenAddress(mint, solanaPublicKey);
                        try {
                            const info = await connection.getTokenAccountBalance(ata);
                            setBalance(info.value.uiAmountString || '0');
                        } catch (e) {
                            setBalance('0'); // Account likely doesn't exist
                        }
                    }
                } else if (sourceChain === 'SUI') {
                    if (!suiAccount) { setBalance('0'); return; }
                    // Handle Coin (SUI) vs Token
                    // For now, assume simplified SUI check or use coinType
                    // Real app needs exact coinType from tokenData
                    const coinType = sourceToken.symbol === 'SUI' ? '0x2::sui::SUI' : sourceToken.contractAddress;
                    if (coinType) {
                        const bal = await suiClient.getBalance({ owner: suiAccount.address, coinType });
                        const decimals = sourceToken.decimals || 9;
                        setBalance((parseInt(bal.totalBalance) / Math.pow(10, decimals)).toString());
                    }
                } else if (sourceChain === 'APTOS') {
                    if (!aptosAccount) { setBalance('0'); return; }
                    // Simplified Aptos balance check using a client or resource view
                    // This requires an AptosClient instance or helper
                    // For now, placeholder or use window.aptos if available (not recommended)
                    // Or fetch resource
                    // TODO: Implement Aptos resource fetching properly
                    setBalance('0'); // Placeholder
                } else if (sourceChain === 'BSC' || sourceChain === 'BASE') {
                    if (isNativeToken && nativeBalance) {
                        const formatted = formatUnits(nativeBalance.value, nativeBalance.decimals);
                        setBalance(formatted);
                    } else if (tokenAddress && tokenBalance !== undefined && sourceToken) {
                        const formatted = formatUnits(tokenBalance, sourceToken.decimals || 18);
                        setBalance(formatted);
                    } else {
                        setBalance('0');
                    }
                } else if (sourceChain === 'TRON') {
                    if (!tronAddress) { setBalance('0'); return; }
                    const tronWeb = (window as any).tronWeb;
                    if (!tronWeb || !tronWeb.ready) { setBalance('0'); return; }

                    if (sourceToken.symbol === 'TRX') {
                        const bal = await tronWeb.trx.getBalance(tronAddress);
                        setBalance((bal / 1_000_000).toString());
                    } else if (sourceToken.contractAddress) {
                        try {
                            const contract = await tronWeb.contract().at(sourceToken.contractAddress);
                            const bal = await contract.balanceOf(tronAddress).call();
                            setBalance((parseInt(bal.toString()) / Math.pow(10, sourceToken.decimals || 6)).toString());
                        } catch (e) {
                            setBalance('0');
                        }
                    } else {
                        setBalance('0');
                    }
                }
            } catch (err) {
                console.error("Failed to fetch balance", err);
                setBalance('0');
            }
        };

        fetchBalance();
        // Set interval to refresh?
    }, [sourceToken, sourceChain, solanaPublicKey, suiAccount, aptosAccount, evmAddress, tronAddress, connection, suiClient, nativeBalance, tokenBalance]);

    const handleMax = () => {
        if (balance) setAmount(balance);
    };

    // Auto-Quote Effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (amount && sourceToken && destToken) {
                handleGetQuote();
            } else {
                setQuote(null);
            }
        }, 500); // Debounce 500ms

        return () => clearTimeout(timeoutId);
    }, [amount, sourceToken, destToken, sourceChain, destChain]);

    // Get Quote
    const handleGetQuote = async () => {
        if (!sourceToken || !destToken || !amount) return;
        setLoadingQuote(true);
        // Don't clear quote immediately to avoid flicker, or do if desired
        // setQuote(null); 

        // Determine refund address (sender)
        let refundAddress = '';
        if (sourceChain === 'SOLANA' && solanaPublicKey) refundAddress = solanaPublicKey.toBase58();
        else if (sourceChain === 'SUI' && suiAccount) refundAddress = suiAccount.address;
        else if (sourceChain === 'APTOS' && aptosAccount) refundAddress = aptosAccount.address.toString();
        else if ((sourceChain === 'BSC' || sourceChain === 'BASE') && evmAddress) refundAddress = evmAddress;
        else if (sourceChain === 'TRON' && tronAddress) refundAddress = tronAddress;

        // Fallback for quote-only (dry run) - use a valid-looking dummy if not connected
        if (!refundAddress) {
            // Use zeros or valid format based on chain
            if (sourceChain === 'SOLANA') refundAddress = '11111111111111111111111111111111';
            else if (sourceChain === 'SUI') refundAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
            else if (sourceChain === 'APTOS') refundAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';
            else if (sourceChain === 'TRON') refundAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkkLdtmY'; // dummy TRON address
            else refundAddress = '0x0000000000000000000000000000000000000000'; // EVM
        }

        // Calculate atomic amount
        let atomicAmount = '0';
        try {
            // decimals defaults to 9 for Sol/Sui if missing (safe fallback)
            const decimals = sourceToken.decimals || 9;
            // Handle float precision carefully, or use a library. 
            // Since we have viem, we can use parseUnits if available, or BigInt manual
            // Simplest for now:
            atomicAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals))).toString();
        } catch (e) {
            console.error("Error converting amount", e);
            setStatusMessage("Invalid amount");
            setLoadingQuote(false);
            return;
        }

        try {
            const result = await getQuote({
                originAsset: sourceToken.assetId,
                destinationAsset: destToken.assetId,
                amount: atomicAmount,
                recipient: recipient || (
                    (destChain === 'SOLANA') ? '11111111111111111111111111111111' :
                        (destChain === 'SUI') ? '0xdea44ff9acdfb17479b9c9373d2ad86599fe697b23da748763e28e29adff80e9' :
                            (destChain === 'APTOS') ? '0x8dd1d2e3c9d6996fface496e387c0fdebb8258c470473e8e9edd66d9fb7f7cb8' :
                                (destChain === 'TRON') ? 'TJQYVshcXXaQY1FBN1K8x9qBw2dE1V8iZk' :
                                    (destChain === 'BSC' || destChain === 'BASE') ? '0xE67B2E77FC2f1Bc49f31E0c8fDab5302Cb4a87b4' : ''
                ),
                recipientType: 'DESTINATION_CHAIN',
                refundTo: refundAddress,
                refundType: 'ORIGIN_CHAIN',
                depositType: 'ORIGIN_CHAIN',
                swapType: 'EXACT_INPUT',
                slippageTolerance: 100, // 1%
                deadline: new Date(Date.now() + 3600000).toISOString().split('.')[0] + 'Z', // 1 hour, no ms
                dry: true
            });
            setQuote(result);
            setStatusMessage(''); // Clear error if any
        } catch (err: any) {
            console.error("Failed to get quote", err);
            // Extract error message from API response if possible
            const errorMsg = err.response?.data?.message || err.message || "Failed to get quote";
            setStatusMessage(errorMsg);
            setQuote(null);
        } finally {
            setLoadingQuote(false);
        }
    };

    // Helper to check wallet connection for source chain
    const isWalletConnected = () => {
        switch (sourceChain) {
            case 'SOLANA': return !!solanaPublicKey;
            case 'SUI': return !!suiAccount;
            case 'APTOS': return !!aptosAccount;
            case 'BSC':
            case 'BASE': return !!evmAddress;
            case 'TRON': return !!tronAddress;
            default: return false;
        }
    };

    const handleSwap = async () => {
        if (!sourceToken || !destToken || !amount) return;

        setStatus('swapping');
        setStatusMessage('Initiating swap...');

        try {
            // 1. Get Non-Dry Quote to generate real deposit address
            const amountVal = parseFloat(amount);
            const atomicAmount = BigInt(Math.floor(amountVal * Math.pow(10, sourceToken.decimals || 9))).toString();

            let refundAddress = '';
            if (sourceChain === 'SOLANA' && solanaPublicKey) refundAddress = solanaPublicKey.toBase58();
            else if (sourceChain === 'SUI' && suiAccount) refundAddress = suiAccount.address;
            else if (sourceChain === 'APTOS' && aptosAccount) refundAddress = aptosAccount.address.toString();
            else if ((sourceChain === 'BSC' || sourceChain === 'BASE') && evmAddress) refundAddress = evmAddress;
            else if (sourceChain === 'TRON' && tronAddress) refundAddress = tronAddress;

            const nonDryQuote = await getQuote({
                originAsset: sourceToken.assetId,
                destinationAsset: destToken.assetId,
                amount: atomicAmount,
                recipient, // Final destination
                recipientType: 'DESTINATION_CHAIN',
                refundTo: refundAddress,
                refundType: 'ORIGIN_CHAIN',
                depositType: 'ORIGIN_CHAIN',
                swapType: 'EXACT_INPUT',
                slippageTolerance: 100,
                deadline: new Date(Date.now() + 3600000).toISOString().split('.')[0] + 'Z',
                dry: false
            });

            if (!nonDryQuote || !nonDryQuote.quote.depositAddress) {
                throw new Error("Failed to generate deposit address");
            }

            setQuote(nonDryQuote);
            const depositAddress = nonDryQuote.quote.depositAddress;

            setStatusMessage('Sending ' + amount + ' ' + (sourceToken?.symbol || '') + ' to bridge...');

            // 2. Execute Transfer to Deposit Address
            if (sourceChain === 'SOLANA') {
                if (!solanaPublicKey) throw new Error("Solana wallet not connected");

                const tx = new SolTransaction();
                const amountBig = BigInt(atomicAmount);

                if (sourceToken.symbol === 'SOL') {
                    tx.add(
                        SystemProgram.transfer({
                            fromPubkey: solanaPublicKey,
                            toPubkey: new PublicKey(depositAddress),
                            lamports: amountBig
                        })
                    );
                } else {
                    const mint = new PublicKey(sourceToken.contractAddress!);
                    const fromAta = await getAssociatedTokenAddress(mint, solanaPublicKey);
                    const toAta = await getAssociatedTokenAddress(mint, new PublicKey(depositAddress));

                    try {
                        const accountInfo = await connection.getAccountInfo(toAta);
                        if (!accountInfo) {
                            tx.add(
                                createAssociatedTokenAccountInstruction(
                                    solanaPublicKey,
                                    toAta,
                                    new PublicKey(depositAddress),
                                    mint,
                                    TOKEN_PROGRAM_ID,
                                    ASSOCIATED_TOKEN_PROGRAM_ID
                                )
                            );
                        }
                    } catch (e) {
                        // ignore check error
                    }

                    tx.add(
                        createTransferInstruction(
                            fromAta,
                            toAta,
                            solanaPublicKey,
                            amountBig,
                            [],
                            TOKEN_PROGRAM_ID
                        )
                    );
                }

                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = solanaPublicKey;

                const sig = await sendSolanaTransaction(tx, connection);
                await connection.confirmTransaction(sig, 'processed');

            } else if (sourceChain === 'SUI') {
                if (!suiAccount) throw new Error("Sui wallet not connected");

                const tx = new Transaction();
                const amountVal = Math.floor(parseFloat(amount) * Math.pow(10, sourceToken.decimals || 9));

                if (sourceToken.symbol === 'SUI') {
                    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountVal)]);
                    tx.transferObjects([coin], tx.pure.address(depositAddress));
                } else {
                    // Non-native Token Transfer (e.g. USDC)
                    const coinType = sourceToken.contractAddress;
                    if (!coinType) throw new Error("CoinType (contract address) missing for this token");

                    // 1. Fetch user's coins of this type via the backend (see utils/suiCoins.ts)
                    const coins = await getAllCoins(suiAccount.address);

                    if (!coins || coins.length === 0) throw new Error(`No ${sourceToken.symbol} coins found in wallet`);

                    // 2. Select coins to cover the amount
                    let totalBalance = 0;
                    const targetAmount = amountVal;
                    const selectedCoins = [];

                    for (const coin of coins) {
                        totalBalance += parseInt(coin.balance);
                        selectedCoins.push(coin);
                        if (totalBalance >= targetAmount) break;
                    }

                    if (totalBalance < targetAmount) throw new Error(`Insufficient ${sourceToken.symbol} balance`);

                    // 3. Merge coins if needed (primary coin is the first one)
                    const primaryCoin = selectedCoins[0].coinObjectId;
                    if (selectedCoins.length > 1) {
                        tx.mergeCoins(
                            tx.object(primaryCoin),
                            selectedCoins.slice(1).map(c => tx.object(c.coinObjectId))
                        );
                    }

                    // 4. Split the exact amount
                    const [splitCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(targetAmount)]);

                    // 5. Transfer to deposit address
                    tx.transferObjects([splitCoin], tx.pure.address(depositAddress));
                }

                await new Promise((resolve, reject) => {
                    signAndExecuteSui({ transaction: tx }, {
                        onSuccess: resolve,
                        onError: reject
                    });
                });

            } else if (sourceChain === 'APTOS') {
                if (!aptosAccount) throw new Error("Aptos wallet not connected");

                const amountAtomic = Math.floor(parseFloat(amount) * Math.pow(10, sourceToken.decimals || 8));
                await signAndSubmitAptos({
                    data: {
                        function: "0x1::aptos_account::transfer_coins",
                        typeArguments: [sourceToken.contractAddress || "0x1::aptos_coin::AptosCoin"],
                        functionArguments: [depositAddress, amountAtomic.toString()]
                    }
                });

            } else if (sourceChain === 'BSC' || sourceChain === 'BASE') {
                if (!evmAddress) throw new Error("EVM wallet not connected");

                if (sourceToken.symbol === 'ETH' || sourceToken.symbol === 'BNB') {
                    await sendEvmTransaction({
                        to: depositAddress as `0x${string}`,
                        value: BigInt(atomicAmount),
                        chainId: targetChainId
                    });
                } else {
                    if (!sourceToken.contractAddress) throw new Error("Contract address missing for this token");
                    if (!depositAddress) throw new Error("Deposit address missing");

                    const erc20Abi = parseAbi([
                        'function transfer(address to, uint256 amount) returns (bool)'
                    ]);

                    await writeContractAsync({
                        address: sourceToken.contractAddress as `0x${string}`,
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [depositAddress as `0x${string}`, BigInt(atomicAmount)],
                        chainId: targetChainId
                    });
                }
            } else if (sourceChain === 'TRON') {
                if (!tronAddress) throw new Error("Tron wallet not connected");

                const tronWeb = (window as any).tronWeb;
                if (!tronWeb || !tronWeb.ready) throw new Error("TronWeb not found. Please ensure TronLink is installed and unlocked.");

                const amountVal = parseFloat(amount);
                // TRON uses 6 decimals typically (TRX, TRC20 USDT)
                const amountAtomic = Math.floor(amountVal * Math.pow(10, sourceToken.decimals || 6));

                if (sourceToken.symbol === 'TRX') {
                    const txId = await tronWeb.trx.sendTransaction(depositAddress, amountAtomic);
                    if (!txId || !txId.result) throw new Error("Transaction rejected or failed");
                } else if (sourceToken.contractAddress) {
                    const contract = await tronWeb.contract().at(sourceToken.contractAddress);
                    const txId = await contract.transfer(depositAddress, amountAtomic).send();
                    if (!txId) throw new Error("Transaction rejected or failed");
                } else {
                    throw new Error("Contract address missing for TRON token");
                }
            }

            setStatus('swapping');
            setStatusMessage('Transaction submitted. Waiting for confirmation...');

            // Poll for status
            const pollInterval = setInterval(async () => {
                try {
                    const statusData = await getSwapStatus(depositAddress);
                    if (statusData && statusData.status === 'SUCCESS') {
                        clearInterval(pollInterval);
                        setStatus('success');
                        setSwapFinalDetails(statusData);
                        setShowSuccessModal(true);
                        setStatusMessage('Swap completed successfully!');
                    } else if (statusData && (statusData.status === 'FAILED' || statusData.status === 'REFUNDED')) {
                        clearInterval(pollInterval);
                        setStatus('failed');
                        setStatusMessage(`Swap ${statusData.status.toLowerCase()}: ${statusData.message || 'Unknown error'}`);
                    }
                } catch (e) {
                    // Ignore polling errors
                }
            }, 5000);

            // Stop polling after 10 minutes if not successful
            setTimeout(() => {
                clearInterval(pollInterval);
                if (status === 'swapping') {
                    setStatus('failed');
                    setStatusMessage('Swap timed out. Please check explorer.');
                }
            }, 600000);

        } catch (err: any) {
            console.error("Swap failed", err);
            setStatus('failed');
            setStatusMessage(err.message || "Swap transaction failed");
        }
    };

    useEffect(() => {
        if (showSuccessModal) {
            playSuccessSound();
        }
    }, [showSuccessModal]);

    const SuccessModal = () => (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="glass-card" style={{
                padding: '32px',
                borderRadius: '24px',
                width: '90%',
                maxWidth: '400px',
                textAlign: 'center',
                border: '1px solid var(--primary-subtle)'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                }}>
                    <CheckCircle size={32} />
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Swap Submitted</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Your transaction has been confirmed on the blockchain.
                </p>

                <div style={{ background: 'var(--surface-elevated)', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Sent</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{amount} {sourceToken?.symbol}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Received</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{quote?.quote.amountOutFormatted} {destToken?.symbol}</span>
                    </div>
                    {swapFinalDetails?.swapDetails?.destinationChainTxHashes?.[0]?.explorerUrl && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                            <a
                                href={swapFinalDetails.swapDetails.destinationChainTxHashes[0].explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--primary)', fontSize: '10px', textDecoration: 'none' }}
                            >
                                View on Explorer
                            </a>
                        </div>
                    )}
                </div>

                <Button fullWidth onClick={() => {
                    setShowSuccessModal(false);
                    setStatus('idle');
                    setStatusMessage('');
                    setAmount('');
                    setQuote(null);
                }}>
                    Close
                </Button>
            </div>
        </div>
    );

    return (
        <div className="page-enter animate-fadeIn" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>
                <button className="nav-icon hover-scale" onClick={() => navigate(-1)} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative', zIndex: 1 }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.5px',
                    margin: 0,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                }}>Swap</h1>
            </div>

            <div className="glass-card card-interactive animate-slideUp" style={{ padding: '24px', borderRadius: '28px', marginBottom: '24px', position: 'relative', border: '1px solid var(--glass-border)' }}>
                {/* Source */}
                <div style={{ background: 'var(--input-bg)', borderRadius: '20px', padding: '16px', border: '1px solid transparent', transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <label style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-secondary)' }}>You pay</label>
                        {balance && <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Balance: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{parseFloat(balance).toFixed(4)}</span></span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="animate-digit-pulse"
                                style={{ width: '100%', fontSize: '22px', fontWeight: 500, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', padding: 0 }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <select
                                    value={sourceChain}
                                    onChange={(e) => setSourceChain(e.target.value)}
                                    style={{ flex: 1, padding: '8px', paddingLeft: '28px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '9px', fontWeight: 500, cursor: 'pointer', appearance: 'none' }}
                                >
                                    <option value="SOLANA">Solana</option>
                                    <option value="SUI">Sui</option>
                                    <option value="APTOS">Aptos</option>
                                    <option value="BSC">BSC</option>
                                    <option value="BASE">Base</option>
                                    <option value="TRON">Tron</option>
                                </select>
                                <div style={{ position: 'absolute', left: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    {sourceChain === 'SOLANA' && <img src={solanaLogo} alt="Solana" style={{ width: '14px', height: '14px' }} />}
                                    {sourceChain === 'SUI' && <img src={suiLogo} alt="Sui" style={{ width: '14px', height: '14px' }} />}
                                    {sourceChain === 'APTOS' && <img src={aptosLogo} alt="Aptos" style={{ width: '14px', height: '14px' }} />}
                                    {sourceChain === 'BSC' && <img src={bnbLogo} alt="BSC" style={{ width: '14px', height: '14px' }} />}
                                    {sourceChain === 'BASE' && <img src="https://avatars.githubusercontent.com/u/108554348?s=200&v=4" alt="Base" style={{ width: '14px', height: '14px', borderRadius: '50%' }} />}
                                    {sourceChain === 'TRON' && <img src={tronLogo} alt="Tron" style={{ width: '14px', height: '14px' }} />}
                                </div>
                                <div style={{ position: 'absolute', right: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    <ArrowDown size={12} color="var(--text-secondary)" />
                                </div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                {(sourceToken?.icon || ['SOL', 'SUI', 'APT', 'BNB', 'TRX', 'USDC'].includes(sourceToken?.symbol || '')) && (
                                    <img
                                        src={
                                            sourceToken?.symbol === 'SOL' ? solanaLogo :
                                                sourceToken?.symbol === 'SUI' ? suiLogo :
                                                    sourceToken?.symbol === 'APT' ? aptosLogo :
                                                        sourceToken?.symbol === 'BNB' ? bnbLogo :
                                                            sourceToken?.symbol === 'TRX' ? tronLogo :
                                                                sourceToken?.symbol === 'USDC' ? usdcLogo :
                                                                    sourceToken?.icon
                                        }
                                        alt={sourceToken?.symbol || ''}
                                        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', pointerEvents: 'none' }}
                                    />
                                )}
                                <select
                                    value={sourceToken?.symbol || ''}
                                    onChange={(e) => {
                                        const chainId = sourceChain === 'SOLANA' ? 'sol' : sourceChain.toLowerCase();
                                        setSourceToken(tokens.find(t => t.symbol === e.target.value && t.blockchain === chainId) || null);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        paddingLeft: (sourceToken?.icon || ['SOL', 'SUI', 'APT', 'BNB', 'TRX', 'USDC'].includes(sourceToken?.symbol || '')) ? '32px' : '8px',
                                        borderRadius: '12px',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        appearance: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">Select</option>
                                    {tokens.filter(t => t.blockchain === (sourceChain === 'SOLANA' ? 'sol' : sourceChain.toLowerCase()) && (t.symbol === 'USDC' || t.symbol === 'USDT' || ['SOL', 'SUI', 'APT', 'BNB', 'ETH', 'AVAX', 'POL', 'GNO', 'TRX'].includes(t.symbol))).map(t => (
                                        <option key={t.assetId} value={t.symbol}>{t.symbol}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    <ArrowDown size={12} color="var(--text-secondary)" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                        <button
                            className="hover-scale"
                            onClick={handleMax}
                            style={{
                                background: 'var(--primary-subtle, rgba(139, 92, 246, 0.1))',
                                color: 'var(--primary)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '4px 10px',
                                fontSize: '9px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            MAX
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '-16px 0', position: 'relative', zIndex: 10 }}>
                    <button onClick={() => {
                        const tempChain = sourceChain;
                        setSourceChain(destChain);
                        setDestChain(tempChain);
                        const tempToken = sourceToken;
                        setSourceToken(destToken);
                        setDestToken(tempToken);
                    }} className="hover-scale hover-glow" style={{ background: 'var(--surface)', border: '4px solid var(--background)', borderRadius: '50%', width: '40px', height: '40px', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                        <ArrowDown size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Destination */}
                <div style={{ background: 'var(--input-bg)', borderRadius: '20px', padding: '16px', border: '1px solid transparent', transition: 'all 0.3s ease', marginTop: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px', display: 'block' }}>You receive</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="0.00"
                                value={quote?.quote.amountOutFormatted || ''}
                                readOnly
                                style={{
                                    width: '100%',
                                    fontSize: '22px',
                                    fontWeight: 500,
                                    background: 'transparent',
                                    border: 'none',
                                    color: loadingQuote ? 'var(--text-muted)' : 'var(--text-main)',
                                    outline: 'none',
                                    padding: 0
                                }}
                            />
                            {loadingQuote && (
                                <div style={{ position: 'absolute', left: '0', bottom: '-20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '9px', fontWeight: 500 }}>
                                        <Loader2 className="animate-spin" size={12} /> Fetching best price...
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <select
                                    value={destChain}
                                    onChange={(e) => setDestChain(e.target.value)}
                                    style={{ flex: 1, padding: '8px', paddingLeft: '28px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '10px', fontWeight: 500, cursor: 'pointer', appearance: 'none' }}
                                >
                                    <option value="SOLANA">Solana</option>
                                    <option value="SUI">Sui</option>
                                    <option value="APTOS">Aptos</option>
                                    <option value="BSC">BSC</option>
                                    <option value="BASE">Base</option>
                                    <option value="TRON">Tron</option>
                                </select>
                                <div style={{ position: 'absolute', left: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    {destChain === 'SOLANA' && <img src={solanaLogo} alt="Solana" style={{ width: '14px', height: '14px' }} />}
                                    {destChain === 'SUI' && <img src={suiLogo} alt="Sui" style={{ width: '14px', height: '14px' }} />}
                                    {destChain === 'APTOS' && <img src={aptosLogo} alt="Aptos" style={{ width: '14px', height: '14px' }} />}
                                    {destChain === 'BSC' && <img src={bnbLogo} alt="BSC" style={{ width: '14px', height: '14px' }} />}
                                    {destChain === 'BASE' && <img src="https://avatars.githubusercontent.com/u/108554348?s=200&v=4" alt="Base" style={{ width: '14px', height: '14px', borderRadius: '50%' }} />}
                                    {destChain === 'TRON' && <img src={tronLogo} alt="Tron" style={{ width: '14px', height: '14px' }} />}
                                </div>
                                <div style={{ position: 'absolute', right: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    <ArrowDown size={12} color="var(--text-secondary)" />
                                </div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                {(destToken?.icon || ['SOL', 'SUI', 'APT', 'BNB', 'TRX', 'USDC'].includes(destToken?.symbol || '')) && (
                                    <img
                                        src={
                                            destToken?.symbol === 'SOL' ? solanaLogo :
                                                destToken?.symbol === 'SUI' ? suiLogo :
                                                    destToken?.symbol === 'APT' ? aptosLogo :
                                                        destToken?.symbol === 'BNB' ? bnbLogo :
                                                            destToken?.symbol === 'TRX' ? tronLogo :
                                                                destToken?.symbol === 'USDC' ? usdcLogo :
                                                                    destToken?.icon
                                        }
                                        alt={destToken?.symbol || ''}
                                        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', pointerEvents: 'none' }}
                                    />
                                )}
                                <select
                                    value={destToken?.symbol || ''}
                                    onChange={(e) => {
                                        const chainId = destChain === 'SOLANA' ? 'sol' : destChain.toLowerCase();
                                        setDestToken(tokens.find(t => t.symbol === e.target.value && t.blockchain === chainId) || null);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        paddingLeft: (destToken?.icon || ['SOL', 'SUI', 'APT', 'BNB', 'TRX', 'USDC'].includes(destToken?.symbol || '')) ? '32px' : '8px',
                                        borderRadius: '12px',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        appearance: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">Select</option>
                                    {tokens.filter(t => t.blockchain === (destChain === 'SOLANA' ? 'sol' : destChain.toLowerCase()) && (t.symbol === 'USDC' || t.symbol === 'USDT' || ['SOL', 'SUI', 'APT', 'BNB', 'ETH', 'AVAX', 'POL', 'GNO', 'TRX'].includes(t.symbol))).map(t => (
                                        <option key={t.assetId} value={t.symbol}>{t.symbol}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                    <ArrowDown size={12} color="var(--text-secondary)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recipient Address */}
                <div className="animate-fadeIn" style={{ marginTop: '20px', animationDelay: '0.1s' }}>
                    <label style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Recipient Address ({destChain})</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder={"Enter " + destChain + " address"}
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                fontSize: '10px',
                                background: 'var(--surface-elevated)',
                                border: isRecipientValid ? '1px solid var(--border-color)' : '1px solid var(--error)',
                                borderRadius: '16px',
                                color: 'var(--text-main)',
                                outline: 'none',
                                transition: 'border-color 0.3s, box-shadow 0.3s',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = isRecipientValid ? 'var(--primary)' : 'var(--error)'; e.target.style.boxShadow = isRecipientValid ? '0 0 0 2px rgba(139, 92, 246, 0.2)' : '0 0 0 2px rgba(239, 68, 68, 0.2)'; }}
                            onBlur={(e) => { e.target.style.borderColor = isRecipientValid ? 'var(--border-color)' : 'var(--error)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
                        />
                        {!isRecipientValid && recipient && (
                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                                <AlertCircle color="var(--error)" size={18} />
                            </div>
                        )}
                    </div>
                    {!isRecipientValid && recipient && (
                        <p className="animate-slideUp" style={{ color: 'var(--error)', fontSize: '9px', marginTop: '6px', fontWeight: 500 }}>Please enter a valid {destChain} address</p>
                    )}
                </div>
            </div>

            {/* Wallet Connection if needed */}
            <div className="animate-slideUp stagger-2">
                {!isWalletConnected() && (
                    <div className="glass-panel" style={{ padding: '20px', borderRadius: '24px', marginBottom: '20px', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 500 }}>Connect your {sourceChain} wallet to swap</p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {sourceChain === 'SOLANA' && <WalletMultiButton />}
                            {sourceChain === 'SUI' && <SuiConnectButton />}
                            {(sourceChain === 'APTOS' || sourceChain === 'BSC' || sourceChain === 'BASE' || sourceChain === 'TRON') && (
                                <Button onClick={() => navigate('/settings')} className="btn-animated">Connect via Settings</Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Swap Action */}
                <div style={{ padding: '0 4px' }}>
                    {!isAuthenticated ? (
                        <Button fullWidth onClick={() => navigate('/onboarding')} className="btn-animated hover-lift" style={{ height: '56px', fontSize: '11px', borderRadius: '16px' }}>
                            Login to Swap
                        </Button>
                    ) : (
                        <>
                            {(quote && recipient && isRecipientValid && isWalletConnected()) && (
                                <Button fullWidth onClick={handleSwap} disabled={status === 'swapping'} className="btn-animated hover-lift" style={{ height: '56px', fontSize: '11px', borderRadius: '16px', background: status === 'swapping' ? 'var(--primary-subtle)' : 'var(--primary)' }}>
                                    {status === 'swapping' ? <><Loader2 className="animate-spin" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} /> Confirming...</> : 'Confirm Swap'}
                                </Button>
                            )}

                            {(quote && !isWalletConnected()) && (
                                <Button fullWidth disabled style={{ height: '56px', fontSize: '11px', borderRadius: '16px', opacity: 0.6 }}>
                                    Connect Wallet & Enter Amount
                                </Button>
                            )}

                            {(!quote) && isWalletConnected() && (
                                <Button fullWidth disabled style={{ height: '56px', fontSize: '11px', borderRadius: '16px', opacity: 0.6 }}>
                                    Enter an Amount
                                </Button>
                            )}
                        </>
                    )}
                </div>

                {statusMessage && (
                    <div className="animate-fadeIn" style={{ marginTop: '20px', padding: '16px', borderRadius: '16px', background: status === 'failed' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(139, 92, 246, 0.08)', display: 'flex', gap: '12px', alignItems: 'center', border: `1px solid ${status === 'failed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 92, 246, 0.2)'}` }}>
                        {status === 'failed' && <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: '50%', color: 'var(--error)', display: 'flex' }}><AlertCircle size={18} /></div>}
                        {status === 'swapping' && <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: '50%', color: 'var(--primary)', display: 'flex' }}><Loader2 size={18} className="animate-spin" /></div>}
                        <p style={{ fontSize: '10px', fontWeight: 500, color: status === 'failed' ? 'var(--error)' : 'var(--text-main)' }}>{statusMessage}</p>
                    </div>
                )}
            </div>

            {showSuccessModal && <SuccessModal />}
            <FeatureExplainerModal />
        </div>
    );
}