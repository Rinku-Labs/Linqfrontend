import { ArrowUpRight, ArrowDownLeft, RefreshCw, Smartphone, Wifi, Zap, Tv } from 'lucide-react';
import type { Order } from '../components/TransactionPopup';
import type { LucideIcon } from 'lucide-react';

// Determine the transaction category from the Order object
export type TransactionCategory = 'offramp' | 'onramp' | 'swap' | 'airtime' | 'data' | 'electricity' | 'cabletv';

export function getTransactionCategory(order: Order): TransactionCategory {
    const orderType = order.orderType?.toLowerCase() || '';
    const description = (order.description || '').toLowerCase();
    const accountName = (order.accountName || '').toLowerCase();

    // Bill payments
    if (orderType === 'bill-payment') {
        // Try to identify the bill sub-type from description or accountName
        if (description.includes('airtime') || accountName.includes('airtime')) {
            return 'airtime';
        }
        if (description.includes('data') || accountName.includes('gb') || accountName.includes('mb') || description.includes('mobiledata')) {
            return 'data';
        }
        if (description.includes('electric') || accountName.includes('electric') || description.includes('disco') || accountName.includes('disco') || description.includes('prepaid') || description.includes('postpaid')) {
            return 'electricity';
        }
        if (description.includes('cable') || description.includes('tv') || accountName.includes('dstv') || accountName.includes('gotv') || accountName.includes('startimes') || description.includes('cabletv')) {
            return 'cabletv';
        }
        // Check if (order as any).billType exists (backend may return it)
        const billType = ((order as any).billType || '').toUpperCase();
        if (billType === 'AIRTIME') return 'airtime';
        if (billType === 'MOBILEDATA') return 'data';
        if (billType === 'ELECTRICITY') return 'electricity';
        if (billType === 'CABLETV') return 'cabletv';

        // Default bill payment to airtime (phone icon) as most common bill
        return 'airtime';
    }

    // Swap (SUI or other crypto swaps)
    if (order.coin?.sui) {
        return 'swap';
    }

    // On-ramp / deposit
    if (orderType === 'on-ramp' || orderType === 'onramp' || orderType === 'deposit') {
        return 'onramp';
    }
    if (description.includes('onramp') || description.includes('deposit') || accountName.includes('onramp') || accountName.includes('deposit')) {
        return 'onramp';
    }
    if (order.bankName === 'Linq') {
        return 'onramp';
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
