import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    StellarWalletsKit,
    Networks,
    type ModuleInterface,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';
import {
    WalletConnectModule,
    WalletConnectTargetChain,
} from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { STELLAR_NETWORK_PASSPHRASE } from '../utils/stellarUtils';
import { authenticateStellar, clearStellarToken, getStellarToken } from '../utils/stellarAuth';

const STORAGE_KEY = 'stellarAddress';
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

interface StellarWalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    connect: () => Promise<string | null>;
    disconnect: () => Promise<void>;
    signTransaction: (xdr: string) => Promise<string>;
    /** SEP-10 session token, once the wallet has authenticated. */
    authToken: string | null;
    /** Runs SEP-10 against the connected wallet. */
    authenticate: () => Promise<string | null>;
}

const StellarWalletContext = createContext<StellarWalletContextType | undefined>(undefined);

// The kit is a static class in v2 — initialised once for the whole app.
// Note this differs from the v1 instance API (`new StellarWalletsKit(...)`)
// that most published examples still show.
let initialised = false;
const initKit = () => {
    if (initialised) return;

    const network =
        STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET ? Networks.TESTNET : Networks.PUBLIC;

    const modules: ModuleInterface[] = [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new AlbedoModule(),
        new HanaModule(),
        new RabetModule(),
    ];

    // Every module above is extension-based, so all of them report unavailable on mobile.
    // Freighter's mobile app is the sharp edge: its in-app browser injects only a marker
    // (`window.stellar = { provider: 'freighter', platform: 'mobile' }`) and never an
    // extension API, so FreighterModule.isAvailable() returns false there by design and
    // expects WalletConnect to carry the connection. Without this module the kit has no
    // mobile path at all and offers an "Install" link to users already inside the wallet.
    // With it registered the kit sees a platform wrapper and connects straight through,
    // skipping the wallet picker entirely.
    if (WC_PROJECT_ID) {
        modules.push(
            new WalletConnectModule({
                projectId: WC_PROJECT_ID,
                metadata: {
                    name: 'Linq',
                    description: 'Send money, pay bills, and save in crypto.',
                    // Resolved at runtime so preview deploys pair as themselves rather
                    // than being rejected for an origin mismatch.
                    url: window.location.origin,
                    icons: [`${window.location.origin}/logo.png`],
                },
                allowedChains: [
                    network === Networks.TESTNET
                        ? WalletConnectTargetChain.TESTNET
                        : WalletConnectTargetChain.PUBLIC,
                ],
            })
        );
    }

    StellarWalletsKit.init({ modules, network });
    initialised = true;
};

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
    const [isConnecting, setIsConnecting] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(() => getStellarToken());

    useEffect(() => {
        initKit();
    }, []);

    // Re-confirm a remembered address against the wallet on load. If the user
    // revoked access or switched account, drop it rather than showing a stale one.
    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        (async () => {
            try {
                initKit();
                const { address: live } = await StellarWalletsKit.getAddress();
                if (cancelled) return;
                if (live && live !== address) {
                    setAddress(live);
                    localStorage.setItem(STORAGE_KEY, live);
                }
            } catch {
                if (cancelled) return;
                setAddress(null);
                localStorage.removeItem(STORAGE_KEY);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connect = async (): Promise<string | null> => {
        setIsConnecting(true);
        try {
            initKit();
            const { address: connected } = await StellarWalletsKit.authModal();
            if (connected) {
                setAddress(connected);
                localStorage.setItem(STORAGE_KEY, connected);
            }
            return connected ?? null;
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            await StellarWalletsKit.disconnect();
        } catch {
            // Not every wallet implements disconnect; clearing locally is enough.
        }
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
        // The session belongs to the account that just disconnected; leaving it
        // behind would present a stale identity to the next wallet.
        clearStellarToken();
        setAuthToken(null);
    };

    const signTransaction = async (xdr: string): Promise<string> => {
        initKit();
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
            networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
            address: address ?? undefined,
        });
        return signedTxXdr;
    };

    // SEP-10 is opt-in rather than automatic on connect: it puts a signature
    // prompt in front of the user, and connecting a wallet to check a balance
    // should not demand one.
    const authenticate = async (): Promise<string | null> => {
        if (!address) return null;
        const { token } = await authenticateStellar(address, signTransaction);
        setAuthToken(token);
        return token;
    };

    return (
        <StellarWalletContext.Provider
            value={{
                address,
                isConnected: !!address,
                isConnecting,
                connect,
                disconnect,
                signTransaction,
                authToken,
                authenticate,
            }}
        >
            {children}
        </StellarWalletContext.Provider>
    );
}

export function useStellarWallet() {
    const context = useContext(StellarWalletContext);
    if (context === undefined) {
        throw new Error('useStellarWallet must be used within a StellarWalletProvider');
    }
    return context;
}
