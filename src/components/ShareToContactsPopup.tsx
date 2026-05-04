import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { Copy, MessageCircle, X } from 'lucide-react';
import Button from './ui/Button';

interface ShareToContactsPopupProps {
    username?: string;
    onClose: () => void;
}

type ContactSharingNavigator = Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
    contacts?: {
        select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
    };
};

type ShareCardVariant = 'clean' | 'dark' | 'mint';

const appUrl = 'https://app.uselinq.xyz';
const variants: Array<{ id: ShareCardVariant; label: string }> = [
    { id: 'clean', label: 'Clean' },
    { id: 'dark', label: 'Night' },
    { id: 'mint', label: 'Mint' },
];

const cardStyles: Record<ShareCardVariant, {
    background: string;
    color: string;
    muted: string;
    border: string;
    accent: string;
}> = {
    clean: {
        background: '#FFFFFF',
        color: '#111827',
        muted: '#6B7280',
        border: '#E5E7EB',
        accent: '#8B5CF6',
    },
    dark: {
        background: '#111118',
        color: '#F9FAFB',
        muted: '#A1A1AA',
        border: '#2D2D36',
        accent: '#A78BFA',
    },
    mint: {
        background: '#F8FFFB',
        color: '#10231D',
        muted: '#5F716A',
        border: '#D7EFE5',
        accent: '#10B981',
    },
};

function ShareCard({ variant, username }: { variant: ShareCardVariant; username?: string }) {
    const style = cardStyles[variant];
    const handle = username ? `@${username.toLowerCase()}` : 'A Linq user';

    return (
        <div
            style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: style.background,
                color: style.color,
                border: `1px solid ${style.border}`,
                borderRadius: '24px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.12)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '9px',
                            background: style.accent,
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 800,
                        }}
                    >
                        L
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>Linq</span>
                </div>
                <span style={{ fontSize: '8px', color: style.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Fast transfers
                </span>
            </div>

            <div>
                <p style={{ fontSize: '11px', color: style.muted, marginBottom: '10px' }}>{handle} sent money in seconds.</p>
                <h3 style={{ fontSize: '25px', lineHeight: 1.15, fontWeight: 800, letterSpacing: 0 }}>
                    Move money without the wait.
                </h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '14px' }}>
                <div>
                    <p style={{ fontSize: '9px', color: style.muted, marginBottom: '4px' }}>Try it here</p>
                    <p style={{ fontSize: '11px', fontWeight: 800 }}>{appUrl.replace('https://', '')}</p>
                </div>
                <div
                    aria-hidden
                    style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        border: `1px solid ${style.border}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '3px',
                        padding: '8px',
                    }}
                >
                    {Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} style={{ background: index % 2 === 0 ? style.accent : style.border, borderRadius: '2px' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ShareToContactsPopup({ username, onClose }: ShareToContactsPopupProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [selectedVariant, setSelectedVariant] = useState<ShareCardVariant>('clean');
    const [isSharing, setIsSharing] = useState(false);
    const handle = username ? `@${username.toLowerCase()}` : 'Linq';
    const shareText = `${handle} just sent money with Linq in seconds. Try it: ${appUrl}`;

    const createShareFile = async () => {
        if (!cardRef.current) return null;

        const canvas = await html2canvas(cardRef.current, {
            backgroundColor: cardStyles[selectedVariant].background,
            scale: 2,
            useCORS: true,
            logging: false,
        });

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png', 0.95);
        });

        if (!blob) return null;
        return new File([blob], `linq-share-${selectedVariant}.png`, { type: 'image/png' });
    };

    const downloadCard = async (file: File) => {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = URL.createObjectURL(file);
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleShareCard = async () => {
        const nav = navigator as ContactSharingNavigator;
        setIsSharing(true);

        try {
            if (nav.contacts?.select) {
                await nav.contacts.select(['name', 'tel', 'email'], { multiple: true });
            }

            const file = await createShareFile();
            const shareData = {
                title: 'Try Linq',
                text: shareText,
                url: appUrl,
                files: file ? [file] : undefined,
            } as ShareData;

            if (nav.share && (!file || !nav.canShare || nav.canShare(shareData))) {
                await nav.share(shareData);
            } else if (file) {
                await downloadCard(file);
                if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
            } else if (nav.share) {
                await nav.share({
                    title: 'Try Linq',
                    text: shareText,
                    url: appUrl,
                });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
            }
        } finally {
            setIsSharing(false);
            onClose();
        }
    };

    const handleCopyLink = async () => {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(appUrl);
        }
        onClose();
    };

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.58)',
                backdropFilter: 'blur(6px)',
                padding: '24px',
                animation: 'fadeIn 0.25s ease-out',
            }}
            onClick={onClose}
        >
            <div
                className="animate-scaleIn"
                style={{
                    width: '100%',
                    maxWidth: '360px',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.2)',
                    position: 'relative',
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--input-bg)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X size={16} />
                </button>

                <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', paddingRight: '34px' }}>
                    That transfer was fast
                </h2>
                <p style={{ fontSize: '10px', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Pick a card and share it to WhatsApp, contacts, or any app from your phone share sheet.
                </p>

                <div ref={cardRef} style={{ width: '300px', maxWidth: '100%', margin: '0 auto 14px' }}>
                    <ShareCard variant={selectedVariant} username={username} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                    {variants.map((variant) => (
                        <button
                            key={variant.id}
                            type="button"
                            onClick={() => setSelectedVariant(variant.id)}
                            style={{
                                height: '34px',
                                borderRadius: '12px',
                                background: selectedVariant === variant.id ? 'var(--primary)' : 'var(--input-bg)',
                                color: selectedVariant === variant.id ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '9px',
                                fontWeight: 700,
                            }}
                        >
                            {variant.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Button
                        type="button"
                        onClick={handleShareCard}
                        disabled={isSharing}
                        style={{ height: '46px', borderRadius: '14px', background: '#25D366', color: '#ffffff' }}
                    >
                        <MessageCircle size={16} />
                        {isSharing ? 'Preparing...' : 'Share Card'}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleCopyLink}
                        style={{ height: '46px', borderRadius: '14px' }}
                    >
                        <Copy size={16} />
                        Copy Link
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        style={{
                            height: '46px',
                            borderRadius: '14px',
                            background: 'var(--input-bg)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        Later
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
