import { useState, useRef, useEffect } from 'react';
import { useChain, type Chain } from '../context/ChainContext';
import { ChevronDown, Check } from 'lucide-react';
import './ChainSelector.css';
import suiLogo from '../assets/sui-logo.png';
import solanaLogo from '../assets/solana-logo.png';
import aptosLogo from '../assets/aptos-logo.png';
import bnbLogo from '../assets/bnb-logo.png';
import tronLogo from '../assets/tron-logo.png';

interface ChainSelectorProps {
    allowedChains?: Chain[];
}

const ChainSelector = ({ allowedChains }: ChainSelectorProps) => {
    const { selectedChain, setSelectedChain } = useChain();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const chains: { id: Chain; name: string; logo: string }[] = [
        {
            id: 'SUI',
            name: 'Sui',
            logo: suiLogo
        },
        {
            id: 'SOLANA',
            name: 'Solana',
            logo: solanaLogo
        },
        {
            id: 'APTOS',
            name: 'Aptos',
            logo: aptosLogo
        },
        {
            id: 'BSC',
            name: 'BNB Chain',
            logo: bnbLogo
        },
        {
            id: 'BASE',
            name: 'Base',
            logo: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4'
        },
        {
            id: 'TRON',
            name: 'Tron',
            logo: tronLogo
        }
    ];

    const displayChains = allowedChains ? chains.filter(c => allowedChains.includes(c.id)) : chains;
    const currentChain = displayChains.find(c => c.id === selectedChain) || displayChains[0];

    return (
        <div className="chain-selector-container" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`chain-selector-button ${isOpen ? 'open' : ''}`}
            >
                <img
                    src={currentChain.logo}
                    alt={currentChain.name}
                    className="chain-selector-logo"
                />
                <ChevronDown
                    size={16}
                    className={`chain-selector-chevron ${isOpen ? 'open' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            <div className={`chain-selector-dropdown ${isOpen ? 'open' : ''}`}>
                {displayChains.map((chain) => (
                    <button
                        key={chain.id}
                        onClick={() => {
                            setSelectedChain(chain.id);
                            setIsOpen(false);
                        }}
                        className={`chain-selector-item ${selectedChain === chain.id ? 'selected' : ''}`}
                    >
                        <div className="chain-selector-item-content">
                            <img
                                src={chain.logo}
                                alt={chain.name}
                                className="chain-selector-item-logo"
                            />
                        </div>
                        {selectedChain === chain.id && (
                            <Check size={16} color="var(--primary)" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ChainSelector;
