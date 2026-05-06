import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import Header from '../components/Layout/Header';
import { LogOut, CheckCircle2, XCircle, Copy, ChevronDown, Building2, RefreshCw, ShieldCheck, Camera, User } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import suiLogo from '../assets/sui-logo.png';
import solanaLogo from '../assets/solana-logo.png';
import aptosLogo from '../assets/aptos-logo.png';
import bnbLogo from '../assets/bnb-logo.png';
import tronLogo from '../assets/tron-logo.png';


interface NetworkSelectorProps {
    activeTab: 'SUI' | 'SOLANA' | 'APTOS' | 'BSC' | 'BASE' | 'TRON';
    onSelect: (tab: 'SUI' | 'SOLANA' | 'APTOS' | 'BSC' | 'BASE' | 'TRON') => void;
    logos: { [key: string]: string };
}

const NetworkSelector = ({ activeTab, onSelect, logos }: NetworkSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const networks = [
        { id: 'SUI', name: 'Sui Network', logo: logos.SUI },
        { id: 'SOLANA', name: 'Solana', logo: logos.SOLANA },
        { id: 'APTOS', name: 'Aptos', logo: logos.APTOS },
        { id: 'BSC', name: 'BNB Chain', logo: logos.BSC },
        { id: 'BASE', name: 'Base', logo: logos.BASE },
        { id: 'TRON', name: 'Tron', logo: logos.TRON },
    ] as const;

    const selectedNetwork = networks.find(n => n.id === activeTab);

    return (
        <div style={{ position: 'relative', zIndex: 1000 }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'var(--input-bg)',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                        src={selectedNetwork?.logo}
                        alt={selectedNetwork?.name}
                        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                    />
                    <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-main)' }}>
                        {selectedNetwork?.name}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    color="var(--text-secondary)"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}
                />
            </button>

            {isOpen && (
                <div className="animate-slideDown" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--surface-elevated)',
                    borderRadius: '12px',
                    padding: '4px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    minWidth: '160px',
                    maxHeight: '300px',
                    overflowY: 'auto' as any,
                    border: '1px solid var(--border-color)'
                }}>
                    {networks.map((network) => (
                        <button
                            key={network.id}
                            onClick={() => {
                                onSelect(network.id);
                                setIsOpen(false);
                            }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px',
                                background: activeTab === network.id ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                        >
                            <img src={network.logo} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 500,
                                color: activeTab === network.id ? 'var(--primary)' : 'var(--text-main)'
                            }}>
                                {network.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function Settings() {
    const navigate = useNavigate();
    const currentAccount = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();
    const { publicKey: solanaPublicKey, connected: solanaConnected, wallet: selectedSolanaWallet, select: selectSolanaWallet, disconnect: disconnectSolana } = useWallet();

    // Aptos wallet hooks
    const { account: aptosAccount, connected: aptosConnected, disconnect: disconnectAptos, connect: connectAptos, wallets: aptosWallets } = useAptosWallet();

    // Generic EVM wallet hooks (BSC & Base)
    const { address: evmAddress, isConnected: evmConnected, chainId } = useAccount();
    const { connect: evmConnect, connectors } = useConnect();
    const { disconnect: disconnectEvm } = useDisconnect();
    const { switchChain } = useSwitchChain();

    // Tron wallet hooks
    const { address: tronAddress, connected: tronConnected, disconnect: disconnectTron, select: selectTronWallet, wallets: tronWallets } = useTronWallet();

    // Redirect logic
    const hasInitialConnectionRef = useRef(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Mark initial state
        const isInitiallyConnected = !!(currentAccount || (solanaConnected && solanaPublicKey) || (aptosConnected && aptosAccount) || (evmConnected && evmAddress) || (tronConnected && tronAddress));

        hasInitialConnectionRef.current = isInitiallyConnected;
        setIsMounted(true);
    }, []); // Run once on mount

    useEffect(() => {
        if (!isMounted) return;

        const isConnected = !!(currentAccount || (solanaConnected && solanaPublicKey) || (aptosConnected && aptosAccount) || (evmConnected && evmAddress) || (tronConnected && tronAddress));

        // Only redirect if NOT connected initially, and NOW connected
        if (isConnected && !hasInitialConnectionRef.current) {
            // Prevent multiple redirects
            hasInitialConnectionRef.current = true;
            navigate('/');
        }

        // If user disconnects, reset the ref so they can reconnect and trigger redirect again
        if (!isConnected) {
            hasInitialConnectionRef.current = false;
        }

    }, [currentAccount, solanaConnected, solanaPublicKey, aptosConnected, aptosAccount, evmConnected, evmAddress, isMounted, navigate]);


    const { logout, zkAddress, activeWalletSource, setActiveWalletSource, isVerified, user, updateProfilePicture } = useAuth();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be under 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            updateProfilePicture(base64);
        };
        reader.readAsDataURL(file);
    };

    const [activeTab, setActiveTab] = useState<'SUI' | 'SOLANA' | 'APTOS' | 'BSC' | 'BASE' | 'TRON'>('SUI');

    const prevConnections = useRef({
        sui: false,
        solana: false,
        aptos: false,
        bsc: false,
        base: false,
        tron: false,
    });

    useEffect(() => {
        const currentSui = !!currentAccount;
        const currentSolana = !!(solanaConnected && solanaPublicKey);
        const currentAptos = !!(aptosConnected && aptosAccount);
        const currentBsc = !!(evmConnected && evmAddress && chainId === 56);
        const currentBase = !!(evmConnected && evmAddress && chainId === 8453);
        const currentTron = !!(tronConnected && tronAddress);

        if (currentSui && !prevConnections.current.sui) {
            setActiveTab('SUI');
        } else if (currentSolana && !prevConnections.current.solana) {
            setActiveTab('SOLANA');
        } else if (currentAptos && !prevConnections.current.aptos) {
            setActiveTab('APTOS');
        } else if (currentBsc && !prevConnections.current.bsc) {
            setActiveTab('BSC');
        } else if (currentBase && !prevConnections.current.base) {
            setActiveTab('BASE');
        } else if (currentTron && !prevConnections.current.tron) {
            setActiveTab('TRON');
        }

        prevConnections.current = {
            sui: currentSui,
            solana: currentSolana,
            aptos: currentAptos,
            bsc: currentBsc,
            base: currentBase,
            tron: currentTron,
        };
    }, [currentAccount, solanaConnected, solanaPublicKey, aptosConnected, aptosAccount, evmConnected, evmAddress, chainId, tronConnected, tronAddress]);

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const SUI_LOGO = suiLogo;
    const SOLANA_LOGO = solanaLogo;
    const APTOS_LOGO = aptosLogo;
    const BSC_LOGO = bnbLogo;
    const BASE_LOGO = 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4';
    const TRON_LOGO = tronLogo;

    const renderConnectionStatus = (isConnected: boolean, address?: string) => (
        <div style={{
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'var(--input-bg)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            {isConnected ? (
                <>
                    <CheckCircle2 size={20} color="#10B981" />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '10px', fontWeight: 500, color: '#059669' }}>
                            Connected
                        </p>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {address ? truncateAddress(address) : ''}
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <XCircle size={20} color="var(--text-muted)" />
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        No wallet connected
                    </p>
                </>
            )}
        </div>
    );

    const renderDisconnectButton = (onDisconnect: () => void) => (
        <button
            onClick={onDisconnect}
            style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid var(--error)',
                background: 'var(--surface)',
                color: 'var(--error)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
            }}
        >
            <LogOut size={20} />
            Disconnect Wallet
        </button>
    );

    const renderAptosConnectButton = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aptosWallets?.filter(wallet => wallet.readyState === 'Installed').map((wallet) => (
                <button
                    key={wallet.name}
                    onClick={() => connectAptos(wallet.name)}
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        background: 'var(--primary)',
                        border: 'none',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <img src={wallet.icon} alt={wallet.name} style={{ width: '20px', height: '20px' }} />
                    Connect {wallet.name}
                </button>
            ))}
            {(!aptosWallets || aptosWallets.filter(w => w.readyState === 'Installed').length === 0) && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '10px' }}>
                    No Aptos wallet detected. Please install Petra or Pontem wallet.
                </p>
            )}
        </div>
    );

    const renderEvmConnectionSection = (targetChainId: number, chainName: string) => {
        const isConnected = evmConnected && !!evmAddress;
        const isCorrectChain = chainId === targetChainId;

        // Filter connectors to avoid showing Injected multiple times if possible, or just map them
        // For simplicity, we just map connectors.
        // In a real app, you might want to deduplicate or show specific wallets like MetaMask, Coinbase Wallet, etc.
        const filteredConnectors = connectors.filter((c, i, self) =>
            i === self.findIndex((t) => t.uid === c.uid)
        );

        return (
            <>
                {renderConnectionStatus(isConnected && isCorrectChain, evmAddress)}

                {isConnected && !isCorrectChain && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            padding: '12px',
                            borderRadius: '12px',
                            background: 'rgba(234, 179, 8, 0.1)',
                            border: '1px solid rgba(234, 179, 8, 0.2)',
                            marginBottom: '12px',
                            fontSize: '10px',
                            color: '#EAB308',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <RefreshCw size={16} />
                            <span>Wrong Network. Please switch to {chainName}.</span>
                        </div>
                        <button
                            onClick={() => switchChain({ chainId: targetChainId })}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                background: 'var(--primary)',
                                border: 'none',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            Switch to {chainName}
                        </button>
                        <div style={{ marginTop: '12px' }}>
                            {renderDisconnectButton(() => disconnectEvm())}
                        </div>
                    </div>
                )}

                {isConnected && isCorrectChain && (
                    renderDisconnectButton(() => disconnectEvm())
                )}

                {!isConnected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredConnectors.map((connector) => (
                            <button
                                key={connector.uid}
                                onClick={() => evmConnect({ connector, chainId: targetChainId })}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    background: 'var(--primary)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                Connect {connector.name}
                            </button>
                        ))}
                    </div>
                )}
            </>
        );
    };


    const getCurrentAddress = (): string | undefined => {
        switch (activeTab) {
            case 'SUI':
                return currentAccount?.address;
            case 'SOLANA':
                return solanaPublicKey?.toBase58();
            case 'APTOS':
                return aptosAccount?.address?.toString();
            case 'BSC':
            case 'BASE':
                // Return address only if connected to EVM
                return evmAddress;
            case 'TRON':
                return tronAddress || undefined;
            default:
                return undefined;
        }
    };

    const isCurrentTabConnected = () => {
        switch (activeTab) {
            case 'SUI':
                return !!currentAccount;
            case 'SOLANA':
                return solanaConnected && !!solanaPublicKey;
            case 'APTOS':
                return aptosConnected && !!aptosAccount;
            case 'BSC':
                // Check if connected AND on BSC chain (56)
                return evmConnected && !!evmAddress && chainId === 56;
            case 'BASE':
                // Check if connected AND on Base chain (8453)
                return evmConnected && !!evmAddress && chainId === 8453;
            default:
                return false;
        }
    };

    return (
        <div className="page-enter">
            <Header title="Settings" />

            {/* Profile Picture */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                <div
                    onClick={handleAvatarClick}
                    style={{
                        width: '88px',
                        height: '88px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid var(--primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--surface-elevated)',
                        position: 'relative',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                >
                    {user?.pfp ? (
                        <img src={user.pfp} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <User size={36} color="var(--text-secondary)" />
                    )}
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        background: 'var(--primary)',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--background)',
                    }}>
                        <Camera size={14} color="white" />
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <p style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>Tap to change photo</p>
            </div>

            {/* Active Wallet Source Selector (For ZkLogin Users) */}
            {zkAddress && (
                <div className="glass-card" style={{
                    borderRadius: '24px',
                    padding: '24px',
                    marginBottom: '20px',
                    border: '1px solid var(--primary)',
                    background: 'rgba(var(--primary-rgb), 0.05)'
                }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-main)' }}>
                        Active Wallet Source
                    </h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setActiveWalletSource('zk')}
                            style={{
                                flex: 1,
                                padding: '16px',
                                borderRadius: '16px',
                                border: activeWalletSource === 'zk' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: activeWalletSource === 'zk' ? 'var(--surface)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Linq Wallet</span>
                                {activeWalletSource === 'zk' && <CheckCircle2 size={16} color="var(--primary)" />}
                            </div>
                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {truncateAddress(zkAddress)}
                            </p>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Powered by Google
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveWalletSource('external')}
                            style={{
                                flex: 1,
                                padding: '16px',
                                borderRadius: '16px',
                                border: activeWalletSource === 'external' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: activeWalletSource === 'external' ? 'var(--surface)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>External</span>
                                {activeWalletSource === 'external' && <CheckCircle2 size={16} color="var(--primary)" />}
                            </div>
                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                {currentAccount ? renderConnectionStatus(true, currentAccount.address) : 'Manage below'}
                            </p>
                        </button>
                    </div>
                </div>
            )}

            {/* Unified Wallet Card */}
            <div className="glass-card" style={{
                borderRadius: '24px',
                padding: '24px',
                marginBottom: '20px',
                overflow: 'visible',
                position: 'relative' as any,
                zIndex: 10,
            }}>
                {/* Header with Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                                Wallet
                            </h3>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                Manage your wallets
                            </p>
                        </div>
                    </div>

                    {/* Toggle Switch - Now with 5 options */}
                    {/* Dropdown Selector */}
                    <NetworkSelector
                        activeTab={activeTab}
                        onSelect={setActiveTab}
                        logos={{
                            SUI: SUI_LOGO,
                            SOLANA: SOLANA_LOGO,
                            APTOS: APTOS_LOGO,
                            BSC: BSC_LOGO,
                            BASE: BASE_LOGO,
                            TRON: TRON_LOGO
                        }}
                    />
                </div>

                {/* Content Area */}
                {activeTab === 'SUI' && (
                    <>
                        {renderConnectionStatus(!!currentAccount, currentAccount?.address)}
                        {currentAccount ? (
                            renderDisconnectButton(() => disconnect())
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <ConnectButton
                                    connectText="Connect Sui Wallet"
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        background: 'var(--primary)',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'SOLANA' && (
                    <>
                        {renderConnectionStatus(solanaConnected && !!solanaPublicKey, solanaPublicKey?.toBase58())}
                        {solanaConnected ? (
                            renderDisconnectButton(() => disconnectSolana())
                        ) : (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                <WalletMultiButton style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    height: 'auto',
                                    lineHeight: '1.5'
                                }} />
                                {selectedSolanaWallet && (
                                    <button
                                        onClick={() => selectSolanaWallet(null)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            marginTop: '4px'
                                        }}
                                    >
                                        Change Solana Wallet
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'APTOS' && (
                    <>
                        {renderConnectionStatus(aptosConnected && !!aptosAccount, aptosAccount?.address?.toString())}
                        {aptosConnected ? (
                            renderDisconnectButton(() => disconnectAptos())
                        ) : (
                            renderAptosConnectButton()
                        )}
                    </>
                )}

                {activeTab === 'BSC' && (
                    renderEvmConnectionSection(56, 'BNB Chain')
                )}

                {activeTab === 'BASE' && (
                    renderEvmConnectionSection(8453, 'Base')
                )}

                {activeTab === 'TRON' && (
                    <>
                        {renderConnectionStatus(tronConnected && !!tronAddress, tronAddress || undefined)}
                        {tronConnected ? (
                            renderDisconnectButton(() => disconnectTron())
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {tronWallets?.map((walletItem: any) => (
                                    <button
                                        key={walletItem.adapter.name}
                                        onClick={() => selectTronWallet(walletItem.adapter.name)}
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            borderRadius: '12px',
                                            background: 'var(--primary)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <img src={walletItem.adapter.icon} alt={walletItem.adapter.name} style={{ width: '20px', height: '20px' }} />
                                        Connect {walletItem.adapter.name}
                                    </button>
                                ))}
                                {(!tronWallets || tronWallets.length === 0) && (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '10px' }}>
                                        No Tron wallet detected.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Full Address (Only for active tab if connected) */}
            {isCurrentTabConnected() && (
                <div className="glass-card" style={{
                    borderRadius: '24px',
                    padding: '24px',
                }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)' }}>
                        Wallet Address
                    </h4>
                    <div style={{
                        background: 'var(--input-bg)',
                        borderRadius: '8px',
                        padding: '12px',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{getCurrentAddress()}</span>
                        <button
                            onClick={() => {
                                const addr = getCurrentAddress();
                                if (addr) {
                                    navigator.clipboard.writeText(addr);
                                }
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <Copy size={16} color="var(--text-secondary)" />
                        </button>
                    </div>
                </div>
            )}
            {/* Sign Out Section */}
            <div className="glass-card" style={{
                borderRadius: '24px',
                padding: '24px',
                marginTop: '20px'
            }}>
                <h4 style={{ fontSize: '10px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-main)' }}>
                    Account
                </h4>

                <Button
                    variant="outline"
                    fullWidth
                    onClick={() => navigate('/settings/bank-details')}
                    style={{
                        marginBottom: '12px',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)',
                        display: 'flex',
                        gap: '8px',
                        height: '48px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={20} />
                        <span>Username</span>
                    </div>
                </Button>

                {/* TEMPORARILY DISABLED KYC - Original: {!isVerified && ( ... )} */}
                {/* TEMPORARILY DISABLED KYC */}
                {!isVerified && (
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={() => navigate('/verification')}
                        style={{
                            marginBottom: '12px',
                            display: 'flex',
                            gap: '8px',
                            height: '48px',
                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        <ShieldCheck size={20} />
                        Verify Identity
                    </Button>
                )}

                <Button
                    variant="outline"
                    fullWidth
                    onClick={logout}
                    style={{
                        borderColor: 'var(--error)',
                        color: 'var(--error)',
                        display: 'flex',
                        gap: '8px',
                        height: '48px'
                    }}
                >
                    <LogOut size={20} />
                    Sign Out
                </Button>
            </div>


        </div>
    );
}
