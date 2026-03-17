import { createConfig, http, WagmiProvider } from 'wagmi';
import { bsc, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

interface Props {
    children: React.ReactNode;
}

// Configure wagmi for EVM chains (BSC and Base)
const config = createConfig({
    chains: [bsc, base],
    connectors: [
        injected(),
        walletConnect({
            projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
        }),
    ],
    transports: {
        [bsc.id]: http(import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'),
        [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
    },
});

// Create a separate QueryClient for wagmi to avoid conflicts
const wagmiQueryClient = new QueryClient();

export const BscWalletProvider = ({ children }: Props) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={wagmiQueryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
};

// Export config for use in other components
export { config as wagmiConfig };

