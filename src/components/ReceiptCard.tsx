import { forwardRef } from 'react';
import { Landmark } from 'lucide-react';
import type { Order } from './TransactionPopup';
import logo from '../assets/logo.png';
import nairaLogo from '../assets/naira.png';
import { cleanDisplayValue, displayOrFallback } from '../utils/displayValue';

interface ReceiptCardProps {
    order: Order;
}

/**
 * A styled receipt card component designed specifically for image export/download.
 * Matching the "Spenda" reference design provided by user.
 */
const ReceiptCard = forwardRef<HTMLDivElement, ReceiptCardProps>(({ order }, ref) => {
    const recipientUsername = cleanDisplayValue(order.recipientUsername);
    const accountName = displayOrFallback(order.accountName || (recipientUsername ? `@${recipientUsername}` : ''));
    const bankAccount = cleanDisplayValue(order.bankAccount);
    const bankName = cleanDisplayValue(order.bankName);
    const isUsernameTransfer = !!recipientUsername && !bankName && !bankAccount;
    // Removed unused amountUsdc
    const amountNgn = order.amountNgn?.toLocaleString('en-NG', { maximumFractionDigits: 0 }) || '0';
    const transactionId = order.id || 'N/A';
    const narration = order.description || (recipientUsername ? `Transfer to @${recipientUsername}` : 'FRM Linq User');
    const dateStr = order.createdAt || order.created || '';

    // Format date like: "Thursday, Jan 22 • 04:11 PM"
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const fullDate = `${formattedDate} • ${formattedTime}`;

    return (
        <div
            ref={ref}
            style={{
                width: '375px', // Mobile width standard
                minHeight: '600px',
                background: '#000000',
                color: '#ffffff',
                fontFamily: 'Inter, -apple-system, sans-serif',
                position: 'relative',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                // Wavy bottom SVG mask is tricky with html2canvas often, 
                // so we'll use a CSS radial-gradient approach for the "ticket stub" look at bottom
            }}
        >
            <div style={{ padding: '24px 24px 40px 24px', flex: 1 }}>

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    {/* Logo Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={logo} alt="Linq" style={{ height: '32px', objectFit: 'contain' }} />
                        {/* If logo text isn't in image, add text: <span style={{ fontWeight: 700, fontSize: '13px' }}>Linq</span> */}
                    </div>

                    {/* Bank Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3B82F6' }}>
                        <Landmark size={18} fill="#3B82F6" />
                        <span style={{ fontSize: '10px', fontWeight: 600 }}>{isUsernameTransfer ? 'Username' : 'Bank'}</span>
                    </div>
                </div>

                {/* Main Amount */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <h1 style={{
                        fontSize: amountNgn.length > 10 ? '24px' : amountNgn.length > 7 ? '28px' : '32px',
                        fontWeight: 800,
                        margin: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <img src={nairaLogo} alt="₦" style={{ width: '28px', height: '28px' }} />
                            {amountNgn}
                        </div>
                    </h1>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <p style={{ fontSize: '9px', color: '#9CA3AF', margin: 0 }}>
                        {fullDate}
                    </p>
                </div>

                {/* Details Container */}
                <div style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <DetailRow label="Type" value={isUsernameTransfer ? 'Username Transfer' : 'Bank Transfer'} />

                    <DashedLine />

                    <DetailRow label="Sent by" value="You (via Linq)" />

                    <DashedLine />

                    <DetailRow label="Sent to" value={accountName} valueStyle={{ textTransform: 'uppercase' }} />

                    <DashedLine />

                    {!isUsernameTransfer && bankName && bankAccount && (
                        <>
                            <DetailRow
                                label="Receivers Account"
                                value={`${bankName} (${bankAccount})`}
                            />

                            <DashedLine />
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: '#9CA3AF' }}>Amount</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <img src={nairaLogo} alt="₦" style={{ width: '14px', height: '14px' }} />
                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#ffffff' }}>{amountNgn}</span>
                        </div>
                    </div>

                    <DashedLine />

                    <DetailRow label="Narration" value={narration} />

                    <DashedLine />

                    <DetailRow
                        label="Reference ID"
                        value={transactionId}
                        valueStyle={{ fontSize: '9px', fontFamily: 'monospace' }}
                    />
                </div>
            </div>

            {/* Wavy Bottom Decoration */}
            <div style={{
                height: '16px',
                background: '#000000',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 10px',
                // Create "teeth" at the bottom
                // radial-gradient circle at bottom to transparent
                backgroundImage: 'radial-gradient(circle at 10px 10px, transparent 10px, #000000 11px)',
                backgroundRepeat: 'repeat-x',
                width: '100%',
                position: 'absolute',
                bottom: '-10px', // Push slightly out to create the edge
                left: 0,
                transform: 'rotate(180deg)' // Flip so holes serve as teeth
            }} />

            {/* Alternative approach if the above is tricky: add white circles at the bottom of the black card */}
            <div style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: '12px',
                background: '#ffffff', // Background color of the page (white/light)
                // Mask to cut out circles? easier to just draw white circles on top of black
                display: 'flex',
                justifyContent: 'space-between',
                overflow: 'hidden'
            }}>
                {[...Array(20)].map((_, i) => (
                    <div key={i} style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ffffff', // Match page background (simulates holes)
                        flexShrink: 0,
                        marginTop: '-10px', // Pushes circle up into the card
                    }} />
                ))}
            </div>
        </div>
    );
});

ReceiptCard.displayName = 'ReceiptCard';

function DetailRow({ label, value, valueStyle = {} }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', color: '#9CA3AF' }}>{label}</span>
            <span style={{
                fontSize: '9px',
                fontWeight: 600,
                color: '#ffffff',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                ...valueStyle
            }}>
                {value}
            </span>
        </div>
    );
}

function DashedLine() {
    return (
        <div style={{
            height: '1px',
            width: '100%',
            borderBottom: '1px dashed rgba(255,255,255,0.1)',
            margin: '16px 0'
        }} />
    );
}

export default ReceiptCard;
