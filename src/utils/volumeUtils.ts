import { formatStatus } from '../components/TransactionPopup';
import type { Order } from '../components/TransactionPopup';

// Daily off-ramp volume limit in USD
export const DAILY_LIMIT = 100;

/**
 * Calculates the total volume of successful off-ramp transactions for the current UTC day.
 * @param orders List of transaction orders
 * @returns Total volume in USD
 */
export const calculateDailyOffRampVolume = (orders: Order[]): number => {
    // Get start of today in UTC
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    return orders.reduce((total, order) => {
        // Parse order date
        const orderDate = new Date(order.createdAt || order.created || 0);

        // precise check on status
        let isOffRamp = false;

        // Priority check: orderType
        if (order.orderType) {
            const type = order.orderType.toLowerCase();
            isOffRamp = type === 'off-ramp' || type === 'offramp' || type === 'withdrawal';
        } else {
            // Fallback (Existing logic updated to check bankName first)
            // If bankName is 'Linq', it's On-Ramp. If likely a real bank (not empty/null), it's Off-Ramp.
            if (order.bankName === 'Linq') {
                isOffRamp = false;
            } else if (order.bankName) {
                isOffRamp = true;
            } else {
                isOffRamp = !order.coin?.sui;
            }
        }

        // Check if status is completed
        const status = formatStatus(order.status);
        const isCompleted = status === 'Completed' || status === 'Settled in treasury' || status === 'Disbursed';

        // Check if transaction is from today (UTC)
        const isToday = orderDate >= startOfDay;

        if (isOffRamp && isCompleted && isToday) {
            return total + (Number(order.amountStableCoin) || 0);
        }
        return total;
    }, 0);
};
