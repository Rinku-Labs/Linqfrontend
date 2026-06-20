/**
 * Maps backend transaction statuses to simplified frontend states.
 * 
 * Used for flow control (deciding which UI view to show).
 * The user-facing display label comes from formatStatus() in TransactionPopup.tsx.
 *
 * Only 3 states:
 * - 'completed' — transaction finished successfully
 * - 'pending'   — transaction is in progress (any intermediate state)
 * - 'failed'    — transaction failed, was rejected, expired, or refunded
 */
export const mapTransactionStatus = (status: string): 'completed' | 'pending' | 'failed' => {
    const s = status?.toLowerCase()?.trim() || '';

    // Success states
    if (['disbursed', 'completed', 'success', 'received_in_treasury', 'received in treasury', 'settled in treasury', 'settled_in_treasury', 'crypto confirmed'].includes(s)) {
        return 'completed';
    }

    // Treasury queue — order settled, awaiting disbursement
    if (s.includes('treasury queue') || s.includes('in treasury')) {
        return 'completed';
    }

    // Treasury worker statuses indicate successful processing
    if (s.includes('treasury worker')) {
        return 'completed';
    }

    // Failure states (includes refunds — at flow-control level, refund = terminal like failure)
    if (['failed', 'expired', 'rejected', 'timeout: no deposit received', 'failed to send transaction', 'transaction failed', 'cancelled', 'refunded', 'fiat refunded', 'bill refunded'].includes(s)) {
        return 'failed';
    }

    // Everything else (pending, initiated, created, awaiting_payment, fiat received,
    // processing, in_order_queue, payment_processing, wallet watcher, etc.) is pending
    return 'pending';
};

