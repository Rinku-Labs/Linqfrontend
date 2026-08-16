import './polyfills' // MUST BE FIRST
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ChainProvider } from './context/ChainContext.tsx'
import { SolanaWalletProvider } from './context/SolanaWalletProvider.tsx'
import { StellarWalletProvider } from './context/StellarWalletProvider.tsx'
import { AptosWalletProvider } from './context/AptosWalletProvider.tsx'
import { BscWalletProvider } from './context/BscWalletProvider.tsx'
import { TronWalletProvider } from './context/TronWalletProvider.tsx'
import { SavingsProvider } from './context/SavingsContext.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { createSuiGrpcClient, getSuiGrpcUrl, type SuiNetwork } from './utils/suiClient'
import '@mysten/dapp-kit/dist/index.css'

// Network configuration.
//
// `createNetworkConfig` + `getJsonRpcFullnodeUrl` is deliberately gone: JSON-RPC
// is deprecated on the public full nodes and every method it produced now
// returns "Method not found", which is what broke balances and signing. See
// utils/suiClient.ts. `createClient` is a documented escape hatch on
// SuiClientProvider and is honoured verbatim at runtime — the cast is only
// needed because dapp-kit@1.1.3 still types the context client as
// `SuiJsonRpcClient`. Every method this app calls on the context client
// (getBalance, listCoins, executeTransaction, simulateTransaction,
// waitForTransaction, and the `client` that `Transaction.toJSON`/`build` uses to
// resolve gas and object refs) exists on SuiGrpcClient.
const networkConfig = {
  devnet: { url: getSuiGrpcUrl('devnet'), network: 'devnet' },
  testnet: { url: getSuiGrpcUrl('testnet'), network: 'testnet' },
  mainnet: { url: getSuiGrpcUrl('mainnet'), network: 'mainnet' },
} as const

const createClient = (name: keyof typeof networkConfig) =>
  createSuiGrpcClient(name as SuiNetwork) as unknown as SuiJsonRpcClient

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet" createClient={createClient}>
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
                        <StellarWalletProvider>
                          <ThemeProvider>
                            <App />
                          </ThemeProvider>
                        </StellarWalletProvider>
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

