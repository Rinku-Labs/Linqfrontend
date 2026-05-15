import { useRef, useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import logo from '../assets/logo.png';
import type { Order } from './TransactionPopup';

interface Props {
    orders: Order[];
    username?: string;
    onClose: () => void;
}

const normalizeCompleted = (status: string) => {
    const s = status?.toLowerCase()?.trim() || '';
    return ['completed', 'settled in treasury', 'settled_in_treasury', 'disbursed',
        'received in treasury', 'received_in_treasury'].includes(s);
};

export default function StatsShareModal({ orders, username, onClose }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const completed = orders.filter(o => normalizeCompleted(o.status));
    const totalVolume = completed.reduce((s, o) => s + (o.amountStableCoin || 0), 0);
    const totalNgn = completed.reduce((s, o) => s + (o.amountNgn || 0), 0);
    const txCount = completed.length;

    const earliest = orders.reduce<Date | null>((min, o) => {
        const d = new Date(o.createdAt || o.created || '');
        return !min || d < min ? d : min;
    }, null);
    const memberSince = earliest
        ? earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : null;

    const tweetText = `I've moved $${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} across ${txCount} transactions on @linqfinance 🚀\n\nJoin the movement 👇\nlinq.finance`;

    const captureCard = async (): Promise<HTMLCanvasElement | null> => {
        if (!cardRef.current) return null;
        return html2canvas(cardRef.current, {
            backgroundColor: '#0f0f14',
            scale: 2,
            useCORS: true,
            logging: false,
        });
    };

    const handleDownload = async () => {
        setIsCapturing(true);
        try {
            const canvas = await captureCard();
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'linq-stats.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            setIsCapturing(false);
        }
    };

    const handleShareToX = () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    };

    const handleNativeShare = async () => {
        if (!navigator.share) return;
        setIsCapturing(true);
        try {
            const canvas = await captureCard();
            if (!canvas) return;
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], 'linq-stats.png', { type: 'image/png' });
                await navigator.share({ files: [file], text: tweetText });
            }, 'image/png');
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, animation: 'fadeIn 0.2s ease-out',
                }}
            />
            {/* Sheet */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    background: 'var(--surface)', borderRadius: '24px 24px 0 0',
                    padding: '24px 20px 40px',
                    zIndex: 1001, animation: 'slideUp 0.3s ease-out',
                    maxHeight: '90vh', overflowY: 'auto',
                }}
            >
                {/* Sheet header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Share your stats</p>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Stats card — this is what gets captured */}
                <div
                    ref={cardRef}
                    style={{
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f14 100%)',
                        padding: '28px 24px',
                        position: 'relative',
                        overflow: 'hidden',
                        marginBottom: '20px',
                    }}
                >
                    {/* Purple glow blob */}
                    <div style={{
                        position: 'absolute', top: '-40px', right: '-40px',
                        width: '160px', height: '160px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    {/* Logo + brand */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <img src={logo} alt="Linq" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>linq</span>
                    </div>

                    {/* Volume */}
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Total volume transacted
                    </p>
                    <p style={{ fontSize: '36px', fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: '4px' }}>
                        ${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
                        ≈ ₦{totalNgn.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </p>

                    {/* Secondary stats */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{
                            background: 'rgba(139,92,246,0.15)', borderRadius: '12px',
                            padding: '10px 14px', flex: 1,
                        }}>
                            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transactions</p>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>{txCount}</p>
                        </div>
                        {memberSince && (
                            <div style={{
                                background: 'rgba(139,92,246,0.15)', borderRadius: '12px',
                                padding: '10px 14px', flex: 1,
                            }}>
                                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Member since</p>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>{memberSince}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '20px' }}>
                        linq.finance{username ? ` · @${username}` : ''}
                    </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleDownload}
                        disabled={isCapturing}
                        style={{
                            flex: 1, padding: '14px', borderRadius: '14px',
                            border: '1.5px solid var(--border-color)',
                            background: 'var(--surface)', color: 'var(--text-main)',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            opacity: isCapturing ? 0.6 : 1,
                        }}
                    >
                        <Download size={15} />
                        Save Image
                    </button>
                    <button
                        onClick={handleShareToX}
                        style={{
                            flex: 1, padding: '14px', borderRadius: '14px',
                            border: 'none', background: '#000',
                            color: '#fff', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        <ExternalLink size={15} />
                        Share on X
                    </button>
                </div>

                {'share' in navigator && (
                    <button
                        onClick={handleNativeShare}
                        disabled={isCapturing}
                        style={{
                            width: '100%', marginTop: '10px', padding: '14px',
                            borderRadius: '14px', border: '1.5px solid var(--border-color)',
                            background: 'transparent', color: 'var(--text-secondary)',
                            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                            opacity: isCapturing ? 0.6 : 1,
                        }}
                    >
                        Share via...
                    </button>
                )}
            </div>
        </>
    );
}
