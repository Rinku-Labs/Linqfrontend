import './polyfills' // MUST BE FIRST
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ChainProvider } from './context/ChainContext.tsx'
import { SolanaWalletProvider } from './context/SolanaWalletProvider.tsx'
import { AptosWalletProvider } from './context/AptosWalletProvider.tsx'
import { BscWalletProvider } from './context/BscWalletProvider.tsx'
import { TronWalletProvider } from './context/TronWalletProvider.tsx'
import { SavingsProvider } from './context/SavingsContext.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import '@mysten/dapp-kit/dist/index.css'

// Network configuration
const { networkConfig } = createNetworkConfig({
  devnet: { url: getFullnodeUrl('devnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
        <WalletProvider autoConnect
          slushWallet={{
            name: 'linq',
          }}>
          <AptosWalletProvider>
            <BscWalletProvider>
              <AuthProvider>
                <ChainProvider>
                  <SavingsProvider>
                    <TronWalletProvider>
                      <SolanaWalletProvider>
                        <ThemeProvider>
                          <App />
                        </ThemeProvider>
                      </SolanaWalletProvider>
                    </TronWalletProvider>
                  </SavingsProvider>
                </ChainProvider>
              </AuthProvider>
            </BscWalletProvider>
          </AptosWalletProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
)

