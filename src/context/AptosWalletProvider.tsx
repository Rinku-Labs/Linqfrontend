import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';

interface Props {
    children: React.ReactNode;
}

export const AptosWalletProvider = ({ children }: Props) => {
    return (
        <AptosWalletAdapterProvider
            autoConnect={true}
            dappConfig={{
                network: Network.MAINNET,
            }}
            onError={(error) => {
                console.error('Aptos Wallet Error:', error);
            }}
        >
            {children}
        </AptosWalletAdapterProvider>
    );
};
