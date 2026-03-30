import { ArrowUpRight, ArrowDownLeft, RefreshCw, Smartphone, Wifi, Zap, Tv } from 'lucide-react';
import type { Order } from '../components/TransactionPopup';
import type { LucideIcon } from 'lucide-react';

// Determine the transaction category from the Order object
export type TransactionCategory = 'offramp' | 'onramp' | 'swap' | 'airtime' | 'data' | 'electricity' | 'cabletv';

export function getTransactionCategory(order: Order): TransactionCategory {
    const orderType = order.orderType?.toLowerCase() || '';
    const description = (order.description || '').toLowerCase();
    const accountName = (order.accountName || '').toLowerCase();
    const billType = ((order as any).billType || '').toUpperCase();

    // Swap explicit
    if (orderType === 'swap') {
        return 'swap';
    }

    // Bill payments
    if (orderType === 'bill-payment' || billType) {
        if (billType === 'AIRTIME' || description.includes('airtime') || accountName.includes('airtime')) {
            return 'airtime';
        }
        if (billType === 'MOBILEDATA' || description.includes('data') || accountName.includes('gb') || accountName.includes('mb') || description.includes('mobiledata')) {
            return 'data';
        }
        if (billType === 'ELECTRICITY' || description.includes('electric') || accountName.includes('electric') || description.includes('disco') || accountName.includes('disco') || description.includes('prepaid') || description.includes('postpaid')) {
            return 'electricity';
        }
        if (billType === 'CABLETV' || description.includes('cable') || description.includes('tv') || accountName.includes('dstv') || accountName.includes('gotv') || accountName.includes('startimes') || description.includes('cabletv')) {
            return 'cabletv';
        }

        // Default bill payment
        return 'airtime';
    }

    // On-ramp / deposit
    if (orderType === 'on-ramp' || orderType === 'onramp' || orderType === 'deposit') {
        return 'onramp';
    }
    if (description.includes('onramp') || description.includes('deposit') || accountName.includes('onramp') || accountName.includes('deposit') || description.includes('paystack') || accountName.includes('paystack')) {
        return 'onramp';
    }
    if (order.bankName === 'Linq') {
        return 'onramp';
    }
    
    // In TransactionPopup.tsx, order.coin?.sui without bankName implies On-ramp, 
    // but because bank transfers from user usually have bankName set,
    // if there's no bankName and no explicit type, we might assume onramp from external wallet.
    // However, default to offramp is generally safer for "Transfer".
    if (!order.bankName && order.coin?.sui && !orderType && !description && !accountName) {
        return 'onramp'; // Fallback for very basic onramp deposits
    }

    // Off-ramp / withdrawal (default for most transfers)
    return 'offramp';
}

// Returns the correct icon component for a given transaction type.
// The color/background should come from the existing status style (getStatusStyle).
export function getTransactionIcon(order: Order): LucideIcon {
    const category = getTransactionCategory(order);

    switch (category) {
        case 'offramp':
            return ArrowUpRight;
        case 'onramp':
            return ArrowDownLeft;
        case 'swap':
            return RefreshCw;
        case 'airtime':
            return Smartphone;
        case 'data':
            return Wifi;
        case 'electricity':
            return Zap;
        case 'cabletv':
            return Tv;
        default:
            return ArrowUpRight;
    }
}
