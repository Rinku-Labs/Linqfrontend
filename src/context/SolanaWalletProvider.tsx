import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { SolanaMobileWalletAdapter } from '@solana-mobile/wallet-adapter-mobile';
import {
    WalletModalProvider
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app's CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
    children: React.ReactNode;
}

export const SolanaWalletProvider = ({ children }: Props) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Mainnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => {
        const url = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network);
        return url;
    }, [network]);

    const wallets = useMemo(
        () => [
            new SolanaMobileWalletAdapter({
                appIdentity: { name: 'Linq v2', uri: 'https://app.uselinq.xyz', icon: 'https://app.uselinq.xyz/favicon.ico' },
                authorizationResultCache: undefined,
            }),
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
