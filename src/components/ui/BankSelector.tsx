import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, Building2 } from 'lucide-react';
import banksData from '../../../banks.json';
import bankUrlData from '../../../bank_url.json';

interface Bank {
    code: string;
    name: string;
}

interface BankSelectorProps {
    selectedBank: string;
    onSelect: (bankName: string) => void;
}

interface BankLogoProps {
    name: string;
    logoUrl?: string | null;
    size?: number;
}

// Create a lookup map for bank logos
const bankLogoMap = new Map<string, string | null>(
    bankUrlData.data.map((bank: any) => [bank.name.toLowerCase(), bank.logo])
);

const getBankLogo = (bankName: string): string | null => {
    return bankLogoMap.get(bankName.toLowerCase()) || null;
};

const BankLogo = ({ name, logoUrl, size = 32 }: BankLogoProps) => {
    const [error, setError] = useState(false);

    // If we have a direct logo URL, try to use it
    // If it fails (onError), we could fallback to the specific slug or just error state

    // Reset error if url changes
    useEffect(() => {
        setError(false);
    }, [logoUrl]);

    if (error || !logoUrl) {
        return (
            <div style={{
                width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                <Building2 size={size * 0.45} color="#9ca3af" />
            </div>
        );
    }

    return (
        <img
            src={logoUrl}
            alt={`${name} logo`}
            onError={() => setError(true)}
            style={{
                width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                objectFit: 'contain', backgroundColor: 'transparent',
                flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
        />
    );
};

export default function BankSelector({ selectedBank, onSelect }: BankSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter banks based on search query
    const filteredBanks = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return (banksData.data as Bank[]).filter(bank =>
            bank.name.toLowerCase().includes(query)
        );
    }, [searchQuery]);

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

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (bankName: string) => {
        onSelect(bankName);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                Select bank
            </label>

            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--input-bg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: isOpen ? '1px solid var(--primary)' : '1px solid transparent'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedBank && (() => {
                        const logoUrl = getBankLogo(selectedBank);
                        return (
                            <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <BankLogo name={selectedBank} logoUrl={logoUrl} size={24} />
                            </div>
                        );
                    })()}
                    <span style={{ color: selectedBank ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {selectedBank || 'Select bank'}
                    </span>
                </div>
                <ChevronDown
                    size={20}
                    color="var(--text-secondary)"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                    }}
                />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="animate-slideDown"
                    style={{
                        position: 'absolute',
                        zIndex: 50,
                        width: '100%',
                        marginTop: '8px',
                        overflow: 'hidden',
                        background: 'rgba(25, 25, 25, 0.85)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                    }}
                >
                    {/* Search Header */}
                    <div style={{ padding: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', position: 'sticky', top: 0, background: 'transparent' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px' }} />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search banks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 10px 10px 36px',
                                    color: 'white',
                                    fontSize: '11px', // Prevents iOS zoom
                                    outline: 'none'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchQuery('');
                                        inputRef.current?.focus();
                                    }}
                                    style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                    <X size={14} color="#9ca3af" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bank List */}
                    <div
                        className="custom-scrollbar"
                        style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            padding: '8px'
                        }}
                    >
                        {filteredBanks.length > 0 ? (
                            filteredBanks.map((bank) => (
                                <div
                                    key={bank.code}
                                    onClick={() => handleSelect(bank.name)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px', borderRadius: '12px', cursor: 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Logo */}
                                    <BankLogo name={bank.name} logoUrl={getBankLogo(bank.name)} />

                                    <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {bank.name}
                                    </span>

                                    {selectedBank === bank.name && (
                                        <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 10px #a855f7' }} />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '10px' }}>
                                No banks found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
