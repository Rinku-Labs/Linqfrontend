import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet, AlertCircle } from 'lucide-react';
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletDetectorProps {
    className?: string;
}

const WalletDetector = ({ className = '' }: WalletDetectorProps) => {
    const { publicKey, connected, wallet } = useWallet();



    // If connected, don't show detector prompt
    if (connected && publicKey) {
        return null;
    }

    // If wallet selected but not connected
    if (wallet && !connected) {
        return (
            <div className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 ${className}`}>
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-400 mb-2">
                            Wallet Disconnected
                        </p>
                        <p className="text-xs text-yellow-400/80 mb-3">
                            Please reconnect your wallet to continue.
                        </p>
                        <div className="wallet-adapter-button-trigger">
                            <WalletMultiButton style={{ height: '36px', fontSize: '10px' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Generic prompt to connect
    return (
        <div className={`p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 ${className}`}>
            <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-purple-400 mb-2">
                        Solana Wallet
                    </p>
                    <p className="text-xs text-purple-400/80 mb-3">
                        Connect your Solana wallet to continue.
                    </p>
                    <div className="wallet-adapter-button-trigger">
                        <WalletMultiButton style={{ height: '36px', fontSize: '10px', backgroundColor: '#3B82F6' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletDetector;
