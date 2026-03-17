declare module '@tronweb3/tronwallet-adapter-react-hooks' {
    import { FC, ReactNode } from 'react';

    export interface Adapter {
        name: string;
        icon: string;
        url: string;
        readyState: string;
        address: string | null;
        connected: boolean;
        connecting: boolean;
        connect(): Promise<void>;
        disconnect(): Promise<void>;
    }

    export interface WalletItem {
        adapter: Adapter;
    }

    export interface WalletProviderProps {
        children: ReactNode;
        adapters?: Adapter[];
        autoConnect?: boolean;
        disableAutoConnectOnLoad?: boolean;
    }

    export const WalletProvider: FC<WalletProviderProps>;

    export function useWallet(): {
        wallet: WalletItem | null;
        address: string | null;
        connected: boolean;
        connecting: boolean;
        disconnect: () => Promise<void>;
        select: (walletName: string) => void;
        connect: () => Promise<void>;
        wallets: WalletItem[];
    };
}
