import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import InlineError from '../../components/ui/InlineError';
import ChainSelector from '../../components/ChainSelector';
import { createBillPayment } from '../../api/bills';

// Wallet hooks
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount as useBscAccount } from 'wagmi';
import { useChain } from '../../context/ChainContext';

import { NETWORK_LOGOS } from '../../utils/networkUtils';

type BillState = {
    billType: string;
    network: string;
    customerId: string;
    customerLabel: string;
    amountNgn: number;
    amountUsdc: number;
    rate: number;
    itemCode: string;
    billerCode: string;
    billerType: string;
    itemName: string;
    coin: {
        sui: boolean;
        base: boolean;
        solana: boolean;
        ethereum: boolean;
        aptos: boolean;
        bsc: boolean;
    };
    verifiedName?: string;
};

export default function BillConfirm() {
    const navigate = useNavigate();
    const location = useLocation();
    const billData = location.state as BillState | null;
    const { selectedChain } = useChain();

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Wallet hooks to get connected wallet address
    const currentSuiAccount = useCurrentAccount();
    const { publicKey: solanaPublicKey } = useWallet();
    const { account: aptosAccount } = useAptosWallet();
    const { address: bscAddress } = useBscAccount();

    // Redirect if no state
    useEffect(() => {
        if (!billData) {
            navigate('/');
        }
    }, [billData, navigate]);

    // Get the user's wallet address for the selected chain
    const getUserWalletAddress = (): string | null => {
        if (selectedChain === 'SUI' && currentSuiAccount) return `${currentSuiAccount.address}`;
        if (selectedChain === 'SOLANA' && solanaPublicKey) return solanaPublicKey.toBase58();
        if (selectedChain === 'APTOS' && aptosAccount) return `${aptosAccount.address}`;
        if (selectedChain === 'BSC' && bscAddress) return bscAddress;
        if (selectedChain === 'BASE' && bscAddress) return bscAddress;
        return null;
    };

    const handleConfirm = async () => {
        if (!billData) return;
        setIsSubmitting(true);
        setError(null);

        const userWalletAddress = getUserWalletAddress();
        if (!userWalletAddress) {
            setError(`Please connect your ${selectedChain} wallet first`);
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await createBillPayment({
                billType: billData.billType,
                network: billData.network,
                customerId: billData.customerId,
                customerLabel: billData.customerLabel,
                amountNgn: billData.amountNgn,
                amountUsdc: billData.amountUsdc,
                rate: billData.rate,
                itemCode: billData.itemCode,
                billerCode: billData.billerCode,
                billerType: billData.billerType,
                itemName: billData.itemName,
                coin: billData.coin,
                userWalletAddress,
            });

            // Navigate to payment page for wallet signing
            navigate('/bills/payment', {
                state: {
                    walletAddress: response.wallet,
                    amount: billData.amountUsdc.toFixed(6),
                    orderId: response.id,
                    chain: selectedChain,
                    billData,
                }
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create bill payment order');
            setIsSubmitting(false);
        }
    };

    if (!billData) return null;

    const isDataPlan = billData.billType === 'MOBILEDATA';


    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
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
                        Confirm Details
                    </h1>
                    <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <ChainSelector />
                    </div>
                </header>
            </div>

            {/* Confirm Card */}
            <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: '20px',
                    padding: '28px 24px',
                    boxShadow: 'var(--card-shadow)',
                    marginBottom: '24px',
                    transition: 'background-color 0.3s ease',
                }}>
                    {/* Bundle / Amount Header */}
                    {isDataPlan ? (
                        <>
                            <p style={{
                                fontSize: '10px',
                                color: 'var(--primary)',
                                fontWeight: 500,
                                marginBottom: '4px',
                            }}>
                                Bundle
                            </p>
                            <h2 style={{
                                fontSize: '22px',
                                fontWeight: 700,
                                color: 'var(--text-main)',
                                marginBottom: '20px',
                                lineHeight: 1.2,
                            }}>
                                {billData.itemName}
                            </h2>
                        </>
                    ) : null}

                    <p style={{
                        fontSize: '10px',
                        color: 'var(--primary)',
                        fontWeight: 500,
                        marginBottom: '4px',
                    }}>
                        Amount
                    </p>
                    <h2 style={{
                        fontSize: '25px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginBottom: '4px',
                        lineHeight: 1.2,
                    }}>
                        ₦{billData.amountNgn.toLocaleString()}
                    </h2>

                    {/* USDC Equivalent */}
                    <div style={{ marginBottom: '24px' }}>
                        <p style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            marginBottom: '2px',
                        }}>
                            Amount in USDC
                        </p>
                        <p style={{
                            fontSize: '17px',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                        }}>
                            {billData.amountUsdc.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>USDC</span>
                        </p>
                    </div>

                    {/* Details Rows */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        {/* Network */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Network:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {NETWORK_LOGOS[billData.network] ? (
                                    <img
                                        src={NETWORK_LOGOS[billData.network]}
                                        alt={billData.network}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '13px' }}>📱</span>
                                )}
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)' }}>{billData.network}</span>
                            </div>
                        </div>

                        {/* Recipient */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: '10px 0',
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{billData.customerLabel}:</span>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>{billData.customerId}</span>
                                {billData.verifiedName && (
                                    <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 500 }}>
                                        {billData.verifiedName}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Amount USDC */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Amount(USDC)</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)' }}>${billData.amountUsdc.toFixed(2)}</span>
                        </div>

                        {/* Rate */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                        }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Rate</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)' }}>
                                    1 USDC = ₦{billData.rate.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ marginBottom: '16px' }}>
                        <InlineError message={error} onDismiss={() => setError(null)} />
                    </div>
                )}

                {/* Confirm Button - pinned to bottom */}
                <div style={{ marginTop: 'auto', paddingBottom: '24px' }}>
                    <Button fullWidth onClick={handleConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating Order...' : 'Confirm'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
