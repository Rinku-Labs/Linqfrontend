import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Layout/Header';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import BankSelector from '../../components/ui/BankSelector';
import banksData from '../../../banks.json';
import bankUrlData from '../../../bank_url.json';
import { verifyBankAccount, type VerifyBankError } from '../../api/bank';
import type { BeneficiaryData } from '../../api/user';
import { fetchAndCacheBeneficiaries, addBeneficiaryAndUpdateCache, deleteBeneficiaryAndUpdateCache } from '../../utils/beneficiariesCache';
import { Loader2 } from 'lucide-react';
import { getCachedOrders, fetchOrders } from '../../utils/ordersCache';
import type { Order } from '../../components/TransactionPopup';
import { findMatchingBanks, getNormalizedBank, type MatchResult } from '../../utils/bankSuggestion';

interface Beneficiary {
    id: number;
    name: string;
    bank: string;
    bankCode: string;
    account: string;
}

const DELETE_THRESHOLD = 80; // px swipe to trigger delete

export default function AccountDetails() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'recents' | 'saved'>('saved');
    const [sendType, setSendType] = useState<'bank' | 'username'>('bank');
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);

    // Track if the update was from selecting a beneficiary
    const isSelectionRef = useRef(false);

    // Form state
    const [accountNumber, setAccountNumber] = useState('');
    const [username, setUsername] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [validatedName, setValidatedName] = useState('');
    const [usernameBankDetails, setUsernameBankDetails] = useState<{bankName: string, bankCode: string, bankAccount: string} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingBeneficiary, setIsSavingBeneficiary] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    const [suggestedBanks, setSuggestedBanks] = useState<MatchResult[]>([]);

    // Beneficiaries from backend API
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [filteredBeneficiaries, setFilteredBeneficiaries] = useState<Beneficiary[]>([]);
    const [showBeneficiarySuggestions, setShowBeneficiarySuggestions] = useState(false);
    const [isBeneficiariesLoading, setIsBeneficiariesLoading] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    // Slide-to-delete state
    const [swipingId, setSwipingId] = useState<number | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStartX = useRef(0);
    const touchCurrentX = useRef(0);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Recents from orders
    const [recentRecipients, setRecentRecipients] = useState<Beneficiary[]>([]);
    const [recentsDisplayCount, setRecentsDisplayCount] = useState(10);
    const [isRecentsLoading, setIsRecentsLoading] = useState(false);
    const recentsScrollRef = useRef<HTMLDivElement>(null);

    // Create a lookup map for bank logos
    const bankLogoMap = useMemo(() => new Map<string, string | null>(
        (bankUrlData.data as { name: string, logo: string | null }[]).map((bank) => [bank.name.toLowerCase(), bank.logo])
    ), []);

    const getBankLogo = (name?: string | null): string | undefined => {
        if (!name) return undefined;
        return bankLogoMap.get(name.toLowerCase()) || undefined;
    };

    // Load beneficiaries from cache (or API if cache is stale)
    const loadBeneficiaries = useCallback(async () => {
        setIsBeneficiariesLoading(true);
        try {
            const data = await fetchAndCacheBeneficiaries();
            const mapped: Beneficiary[] = data.map((b: BeneficiaryData) => ({
                id: b.id,
                name: b.accountName,
                bank: b.bankName,
                bankCode: b.bankCode,
                account: b.bankAccount,
            }));
            setBeneficiaries(mapped);
        } catch {
            setBeneficiaries([]);
        } finally {
            setIsBeneficiariesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBeneficiaries();
    }, [loadBeneficiaries]);

    // Prefill from the scan-to-pay flow (runs once on mount). Setting the fields
    // here lets the existing verify effect resolve and display the account name.
    useEffect(() => {
        const prefill = (location.state as {
            scannedPrefill?: { accountNumber?: string; bankName?: string | null; bankCode?: string | null };
        } | null)?.scannedPrefill;
        if (!prefill?.accountNumber) return;
        setSendType('bank');
        setAccountNumber(prefill.accountNumber);

        // Resolve a bank to prefill, in priority order:
        // 1. The bank the scan detected (OCR/Gemini), normalised to a real code.
        // 2. Otherwise derive it from the account number via the NUBAN check-digit
        //    algorithm — but only when it points to a single, unambiguous bank
        //    (many account numbers match several banks; auto-picking one of those
        //    could send to the wrong bank, so those fall through to the pills).
        let resolvedName = '';
        let resolvedCode = '';

        if (prefill.bankName) {
            const normalized = getNormalizedBank(prefill.bankName);
            if (normalized) {
                resolvedName = normalized.name;
                resolvedCode = normalized.code;
            } else if (prefill.bankCode) {
                resolvedName = prefill.bankName;
                resolvedCode = prefill.bankCode;
            }
        }

        if (!resolvedCode) {
            const matches = findMatchingBanks(prefill.accountNumber);
            if (matches.length === 1) {
                resolvedName = matches[0].bank.name;
                resolvedCode = matches[0].bank.code;
            }
        }

        if (resolvedName && resolvedCode) {
            setBankName(resolvedName);
            setBankCode(resolvedCode);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Extract unique recent recipients from orders
    const extractRecentsFromOrders = useCallback((orders: Order[]): Beneficiary[] => {
        const seen = new Set<string>();
        const recents: Beneficiary[] = [];
        for (const order of orders) {
            // Only include offramp/withdrawal orders that have bank details
            if (!order.bankAccount || !order.bankName) continue;
            const key = `${order.bankAccount}-${order.bankCode || order.bankName}`;
            if (seen.has(key)) continue;
            seen.add(key);
            recents.push({
                id: recents.length + 1,
                name: order.accountName || 'Unknown',
                bank: order.bankName,
                bankCode: order.bankCode || '',
                account: order.bankAccount,
            });
        }
        return recents;
    }, []);

    // Load recents from cached orders on mount
    useEffect(() => {
        const loadRecents = async () => {
            setIsRecentsLoading(true);
            try {
                // Try cache first
                const cached = getCachedOrders();
                if (cached && cached.orders.length > 0) {
                    setRecentRecipients(extractRecentsFromOrders(cached.orders));
                } else {
                    // Fetch if no cache
                    const orders = await fetchOrders(100);
                    setRecentRecipients(extractRecentsFromOrders(orders));
                }
            } catch {
                setRecentRecipients([]);
            } finally {
                setIsRecentsLoading(false);
            }
        };
        loadRecents();
    }, [extractRecentsFromOrders]);

    // Handle scroll to load more recents
    const handleRecentsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
            setRecentsDisplayCount(prev => Math.min(prev + 10, recentRecipients.length));
        }
    }, [recentRecipients.length]);

    // Handle clicks outside suggestions to close them
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowBeneficiarySuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find suggested banks when account number changes
    useEffect(() => {
        // Only trigger NUBAN algorithm if prefix search doesn't block it
        // and it's exactly 10 digits and not already validated
        if (sendType === 'bank' && accountNumber.length === 10 && !showBeneficiarySuggestions && !validatedName) {
            const matches = findMatchingBanks(accountNumber);
            setSuggestedBanks(matches);
        } else {
            setSuggestedBanks([]);
        }
    }, [accountNumber, sendType, showBeneficiarySuggestions, validatedName]);

    // Save beneficiary via cache (keeps cache in sync automatically)
    const saveBeneficiaryToStorage = async (): Promise<boolean> => {
        if (!accountNumber || !bankName || !bankCode) return true;

        try {
            const newEntry = await addBeneficiaryAndUpdateCache({
                bankName,
                bankCode,
                bankAccount: accountNumber,
                accountName: validatedName || 'Unknown',
            });

            const mappedEntry = {
                id: newEntry.id,
                name: newEntry.accountName,
                bank: newEntry.bankName,
                bankCode: newEntry.bankCode,
                account: newEntry.bankAccount,
            };

            // Update local state directly from the returned entry, replacing duplicates from a refreshed cache.
            setBeneficiaries(prev => {
                const withoutDuplicate = prev.filter(b => !(b.account === mappedEntry.account && b.bankCode === mappedEntry.bankCode));
                return [mappedEntry, ...withoutDuplicate];
            });
            toast.success('Beneficiary saved');
            return true;
        } catch (error: unknown) {
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to save beneficiary';
            toast.error(message);
            return false;
        }
    };

    // Handle deleting a beneficiary via swipe (cache stays in sync automatically)
    const handleDeleteBeneficiary = async (id: number) => {
        setDeletingId(id);
        const success = await deleteBeneficiaryAndUpdateCache(id);
        if (success) {
            setBeneficiaries(prev => prev.filter(b => b.id !== id));
        }
        setDeletingId(null);
        setSwipingId(null);
        setSwipeOffset(0);
    };

    // Touch handlers for slide-to-delete
    const handleTouchStart = (id: number, e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchCurrentX.current = e.touches[0].clientX;
        setSwipingId(id);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (swipingId === null) return;
        touchCurrentX.current = e.touches[0].clientX;
        const diff = touchStartX.current - touchCurrentX.current;
        // Only allow left swipe (positive diff)
        setSwipeOffset(Math.max(0, Math.min(diff, 120)));
    };

    const handleTouchEnd = () => {
        if (swipingId === null) return;
        if (swipeOffset >= DELETE_THRESHOLD) {
            handleDeleteBeneficiary(swipingId);
        } else {
            setSwipingId(null);
            setSwipeOffset(0);
        }
    };

    // Verify Bank Account
    // Verify Bank Account or Username
    useEffect(() => {
        const verify = async () => {
            // Skip verification if this update came from selecting a beneficiary
            if (isSelectionRef.current) {
                isSelectionRef.current = false;
                return;
            }

            // Reset states
            setVerificationError('');
            setValidatedName('');

            if (sendType === 'bank') {
                // Bank Verification Logic
                if (accountNumber.length !== 10 || !bankName || !bankCode) {
                    return;
                }

                setIsLoading(true);
                try {
                    const response = await verifyBankAccount(accountNumber, bankCode);
                    setValidatedName(response.accountName);
                } catch (error: unknown) {
                    const err = error as VerifyBankError;
                    setVerificationError(err.message || 'Failed to verify account');
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Username Verification Logic
                if (!username || username.length < 2) return;

                setIsLoading(true);
                try {
                    // Import checkUsername here to avoid top-level import issues if not yet defined in previous step (handled by tool order)
                    // But standard is to import at top. Assuming import is added.
                    const { checkUsername } = await import('../../api/user');
                    const response = await checkUsername(username);
                    setValidatedName(response.data.accountName);
                    setUsernameBankDetails({
                        bankName: response.data.bankName,
                        bankCode: response.data.bankCode,
                        bankAccount: response.data.bankAccount
                    });
                } catch (error: unknown) {
                    console.error("Username check failed", error);
                    const err = error as { response?: { data?: { message?: string } } };
                    setVerificationError(err.response?.data?.message || 'User not found');
                } finally {
                    setIsLoading(false);
                }
            }
        };

        const timeoutId = setTimeout(verify, 800); // 800ms debounce
        return () => clearTimeout(timeoutId);
    }, [accountNumber, bankName, username, sendType]);

    // Handle confirm button
    const handleConfirm = async () => {
        if (sendType === 'bank') {
            if (saveBeneficiary && accountNumber && bankName && bankCode) {
                setIsSavingBeneficiary(true);
                const didSave = await saveBeneficiaryToStorage();
                setIsSavingBeneficiary(false);
                if (!didSave) return;
            }
            const bankLogo = getBankLogo(bankName);

            navigate('/send/amount', {
                state: {
                    accountNumber,
                    bankName,
                    bankCode,
                    recipientName: validatedName,
                    bankLogo
                }
            });
        } else {
            // Send by Username
            navigate('/send/amount', {
                state: {
                    recipientUsername: username,
                    bankName: usernameBankDetails?.bankName,
                    bankCode: usernameBankDetails?.bankCode,
                    accountNumber: usernameBankDetails?.bankAccount,
                    recipientName: validatedName
                }
            });
        }
    };

    // Quick-fill from beneficiary
    const selectBeneficiary = (b: Beneficiary) => {
        isSelectionRef.current = true;
        setAccountNumber(b.account);
        const normalized = getNormalizedBank(b.bank);
        setBankName(normalized?.name || b.bank || '');
        setBankCode(normalized?.code || b.bankCode || '');
        setValidatedName(b.name);
        setFilteredBeneficiaries([]);
        setShowBeneficiarySuggestions(false);
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Start your transfer" showBack />

            <div style={{ padding: '0 4px', flex: 1 }}>
                {/* Send Type Toggle */}
                <div style={{
                    display: 'flex',
                    background: 'var(--surface)',
                    padding: '4px',
                    borderRadius: '16px',
                    marginBottom: '16px',
                    boxShadow: 'var(--card-shadow)'
                }}>
                    <button
                        onClick={() => setSendType('bank')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: sendType === 'bank' ? 'var(--primary)' : 'transparent',
                            color: sendType === 'bank' ? 'white' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Bank Account
                    </button>
                    <button
                        onClick={() => setSendType('username')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: sendType === 'username' ? 'var(--primary)' : 'transparent',
                            color: sendType === 'username' ? 'white' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Username
                    </button>
                </div>

                <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--card-shadow)', transition: 'background-color 0.3s ease', position: 'relative', zIndex: 20 }} ref={suggestionRef}>

                    {sendType === 'bank' ? (
                        <>
                            <div style={{ position: 'relative' }}>
                                <Input
                                    label="Recipient's account"
                                    placeholder="Enter account number"
                                    value={accountNumber}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    showCount
                                    maxLength={10}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 10) {
                                            setAccountNumber(val);

                                            // Search beneficiaries + recents
                                            if (val.length > 0) {
                                                const beneficiaryMatches = beneficiaries.filter(b =>
                                                    b.account.includes(val) || b.name.toLowerCase().includes(val.toLowerCase())
                                                );
                                                const recentMatches = recentRecipients.filter(b =>
                                                    b.account.includes(val) || b.name.toLowerCase().includes(val.toLowerCase())
                                                );
                                                // Merge and deduplicate (beneficiaries take priority)
                                                const seen = new Set(beneficiaryMatches.map(b => `${b.account}-${b.bankCode}`));
                                                const combined = [
                                                    ...beneficiaryMatches,
                                                    ...recentMatches.filter(b => !seen.has(`${b.account}-${b.bankCode}`))
                                                ];
                                                setFilteredBeneficiaries(combined);
                                                setShowBeneficiarySuggestions(combined.length > 0);
                                            } else {
                                                setFilteredBeneficiaries([]);
                                                setShowBeneficiarySuggestions(false);
                                            }

                                            // Clear name if not from selection
                                            if (!isSelectionRef.current) {
                                                setValidatedName('');
                                            }
                                        }
                                    }}
                                    onFocus={() => {
                                        if (filteredBeneficiaries.length > 0) setShowBeneficiarySuggestions(true);
                                    }}
                                />

                                {/* Beneficiary Search Suggestions Dropdown */}
                                {showBeneficiarySuggestions && filteredBeneficiaries.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'var(--surface)',
                                        borderRadius: '16px',
                                        boxShadow: 'var(--nav-shadow)',
                                        border: '1px solid var(--border-color)',
                                        marginTop: '-12px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        zIndex: 100,
                                        padding: '8px'
                                    }}>
                                        {filteredBeneficiaries.map((b) => (
                                            <div
                                                key={b.id}
                                                onClick={() => {
                                                    const normalized = getNormalizedBank(b.bank);
                                                    const finalBankName = normalized?.name || b.bank || '';
                                                    const finalBankCode = normalized?.code || b.bankCode || '';
                                                    const bankLogo = getBankLogo(finalBankName);
                                                    navigate('/send/amount', {
                                                        state: {
                                                            accountNumber: b.account,
                                                            bankName: finalBankName,
                                                            bankCode: finalBankCode,
                                                            recipientName: b.name,
                                                            bankLogo
                                                        }
                                                    });
                                                }}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'rgba(124, 58, 237, 0.1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <User size={16} color="var(--primary)" />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                                                    <p style={{ fontSize: '9px', color: 'var(--text-secondary)', margin: 0 }}>{b.bank} • {b.account}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Show pills if suggested banks exist */}
                            {suggestedBanks.length > 0 && (
                                <div
                                    className="animate-slideUp"
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px',
                                        marginBottom: '16px',
                                        marginTop: '-8px',
                                    }}
                                >
                                    {suggestedBanks.map((match, idx) => (
                                        <button
                                            key={idx}
                                            className="animate-fadeIn"
                                            onClick={() => {
                                                setBankName(match.bank.name);
                                                setBankCode(match.bank.code);
                                                setValidatedName('');
                                                setSuggestedBanks([]);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                background: 'var(--primary)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'opacity 0.2s, transform 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                opacity: 0,
                                                animationDelay: `${0.06 * idx}s`,
                                                animationFillMode: 'forwards',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1)'; }}
                                        >
                                            {(() => {
                                                const logo = getBankLogo(match.bank.name);
                                                return logo ? (
                                                    <img
                                                        src={logo}
                                                        alt=""
                                                        style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '50%',
                                                            objectFit: 'contain',
                                                            marginRight: '6px',
                                                            background: 'rgba(255,255,255,0.2)',
                                                        }}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : null;
                                            })()}
                                            {match.bank.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginBottom: '24px' }}>
                                <BankSelector
                                    selectedBank={bankName}
                                    onSelect={(name) => {
                                        setBankName(name);
                                        const bank = (banksData.data as { name: string, code: string }[]).find(b => b.name === name);
                                        setBankCode(bank?.code ?? '');
                                        // Also clear validated name when bank changes as it needs re-validation
                                        if (name !== bankName) setValidatedName('');
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div style={{ marginBottom: '24px' }}>
                            <Input
                                label="Recipient Username"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/@/g, ''))}
                            />
                        </div>
                    )}

                    {/* Validated Name - shows when account is verified */}
                    {isLoading && (
                        <div style={{
                            marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px',
                            color: 'var(--text-secondary)', fontSize: '10px'
                        }}>
                            <Loader2 className="animate-spin" size={16} />
                            <span>Verifying account...</span>
                        </div>
                    )}

                    {!isLoading && verificationError && (
                        <div style={{
                            marginBottom: '24px', color: '#ef4444', fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px'
                        }}>
                            {verificationError}
                        </div>
                    )}

                    {!isLoading && validatedName && (
                        <div style={{
                            background: 'rgba(124, 58, 237, 0.1)', borderRadius: '12px', padding: '16px',
                            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'
                        }}>
                            <CheckCircle size={16} color="var(--primary)" fill="rgba(124, 58, 237, 0.2)" />
                            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{validatedName}</span>
                        </div>
                    )}

                    {sendType === 'bank' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-main)' }}>Add to saved beneficiaries?</span>
                            <div
                                onClick={() => setSaveBeneficiary(!saveBeneficiary)}
                                style={{
                                    width: '44px', height: '24px', borderRadius: '12px',
                                    background: saveBeneficiary ? 'var(--primary)' : 'var(--border-color)',
                                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                                    position: 'absolute', top: '2px', left: saveBeneficiary ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                        </div>
                    )}

                    <Button
                        fullWidth
                        onClick={handleConfirm}
                        isLoading={isSavingBeneficiary}
                        disabled={sendType === 'bank' ? (!accountNumber || !bankName || isLoading || isSavingBeneficiary || !validatedName) : (!username || isLoading || !validatedName)}
                    >
                        Confirm Amount
                    </Button>
                </div>

                {/* Beneficiaries List - Only show for Bank transfers */}
                {sendType === 'bank' && (
                    <div className="animate-slideUp stagger-2" style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', flex: 1, animationFillMode: 'backwards', boxShadow: 'var(--card-shadow)', transition: 'background-color 0.3s ease', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setActiveTab('recents')}
                                    style={{
                                        background: activeTab === 'recents' ? 'var(--primary)' : 'transparent',
                                        color: activeTab === 'recents' ? 'white' : 'var(--text-secondary)',
                                        padding: '8px 16px', borderRadius: '20px', fontSize: '10px', fontWeight: 500,
                                        transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                                    }}
                                >
                                    Recents
                                </button>
                                <button
                                    onClick={() => setActiveTab('saved')}
                                    style={{
                                        background: activeTab === 'saved' ? 'var(--primary)' : 'transparent',
                                        color: activeTab === 'saved' ? 'white' : 'var(--text-secondary)',
                                        padding: '8px 16px', borderRadius: '20px', fontSize: '10px', fontWeight: 500,
                                        border: 'none', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Saved
                                </button>
                            </div>
                        </div>

                        <div
                            className="custom-scrollbar"
                            ref={activeTab === 'recents' ? recentsScrollRef : undefined}
                            onScroll={activeTab === 'recents' ? handleRecentsScroll : undefined}
                            style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '45vh', overflowY: 'auto', paddingRight: '4px' }}
                        >
                            {activeTab === 'recents' ? (
                                /* --- Recents Tab: from orders --- */
                                isRecentsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                        <Loader2 className="animate-spin" size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                        <p style={{ fontSize: '10px' }}>Loading recents...</p>
                                    </div>
                                ) : recentRecipients.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                        <User size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                        <p style={{ fontSize: '10px' }}>No recent recipients yet</p>
                                    </div>
                                ) : (
                                    recentRecipients.slice(0, recentsDisplayCount).map((b, index) => (
                                        <div
                                            key={`recent-${b.account}-${b.bankCode}`}
                                            className="animate-fadeIn"
                                            onClick={() => {
                                                const normalized = getNormalizedBank(b.bank);
                                                const finalBankName = normalized?.name || b.bank || '';
                                                const finalBankCode = normalized?.code || b.bankCode || '';
                                                const bankLogo = getBankLogo(finalBankName);
                                                navigate('/send/amount', {
                                                    state: {
                                                        accountNumber: b.account,
                                                        bankName: finalBankName,
                                                        bankCode: finalBankCode,
                                                        recipientName: b.name,
                                                        bankLogo
                                                    }
                                                });
                                            }}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                padding: '12px 8px',
                                                borderRadius: '12px',
                                                opacity: 0,
                                                animationDelay: `${0.05 * (index + 1)}s`,
                                                animationFillMode: 'forwards',
                                                transition: 'background 0.2s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div>
                                                <p style={{ fontWeight: 600, fontSize: '10px', marginBottom: '4px', color: 'var(--text-main)' }}>{b.name}</p>
                                                <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{b.bank} • {b.account}</p>
                                            </div>
                                            <div style={{
                                                width: '24px', height: '24px', borderRadius: '50%',
                                                background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <User size={14} color="var(--primary)" />
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                /* --- Saved Tab: beneficiaries --- */
                                isBeneficiariesLoading ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                        <Loader2 className="animate-spin" size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                        <p style={{ fontSize: '10px' }}>Loading beneficiaries...</p>
                                    </div>
                                ) : beneficiaries.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                        <User size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                        <p style={{ fontSize: '10px' }}>No saved beneficiaries yet</p>
                                    </div>
                                ) : (
                                    beneficiaries.map((b, index) => (
                                        <div
                                            key={b.id}
                                            className="animate-fadeIn"
                                            style={{
                                                position: 'relative',
                                                overflow: 'hidden',
                                                borderRadius: '12px',
                                                opacity: 0,
                                                animationDelay: `${0.05 * (index + 1)}s`,
                                                animationFillMode: 'forwards',
                                            }}
                                        >
                                            {/* Delete background revealed on swipe */}
                                            <div style={{
                                                position: 'absolute',
                                                top: 0, bottom: 0, right: 0,
                                                width: '80px',
                                                background: 'var(--error)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '0 12px 12px 0',
                                                opacity: swipingId === b.id ? Math.min(swipeOffset / DELETE_THRESHOLD, 1) : 0,
                                                transition: swipingId === b.id ? 'none' : 'opacity 0.2s',
                                            }}>
                                                {deletingId === b.id ? (
                                                    <Loader2 className="animate-spin" size={18} color="white" />
                                                ) : (
                                                    <Trash2 size={18} color="white" />
                                                )}
                                            </div>

                                            {/* Swipeable foreground card */}
                                            <div
                                                onClick={() => { if (swipeOffset < 5) selectBeneficiary(b); }}
                                                onTouchStart={(e) => handleTouchStart(b.id, e)}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '12px 8px',
                                                    borderRadius: '12px',
                                                    background: 'var(--surface)',
                                                    transform: swipingId === b.id ? `translateX(-${swipeOffset}px)` : 'translateX(0)',
                                                    transition: swipingId === b.id ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    position: 'relative',
                                                    zIndex: 1,
                                                    userSelect: 'none',
                                                    WebkitUserSelect: 'none',
                                                }}
                                            >
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: '10px', marginBottom: '4px', color: 'var(--text-main)' }}>{b.name}</p>
                                                    <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{b.bank} • {b.account}</p>
                                                </div>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                    background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <User size={14} color="var(--primary)" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}

