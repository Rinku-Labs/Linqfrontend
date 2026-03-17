/**
 * Maps backend transaction statuses to frontend display statuses.
 * 
 * Logic:
 * - disbursed, completed, success, received_in_treasury -> 'completed'
 * - failed, expired, rejected -> 'failed'
 * - refunded -> 'refunded'
 * - pending, initiated, created -> 'processing'
 * - awaiting_payment -> 'initiated'
 * - Everything else -> 'processing'
 */
export const mapTransactionStatus = (status: string): 'initiated' | 'processing' | 'completed' | 'refunded' | 'failed' => {
    const s = status.toLowerCase();

    // Success states
    if (['disbursed', 'completed', 'success', 'received_in_treasury', 'settled in treasury', 'crypto confirmed'].includes(s)) {
        return 'completed';
    }

    // Failure states
    if (['failed', 'expired', 'rejected', 'timeout: no deposit received', 'failed to send transaction', 'transaction failed', 'cancelled'].includes(s)) {
        return 'failed';
    }

    // Refund states
    if (s === 'refunded' || s === 'fiat refunded') {
        return 'refunded';
    }

    // Initial states
    if (s === 'awaiting_payment' || s === 'awaiting payment') {
        return 'initiated';
    }

    // "pending", "initiated", "created", "fiat received", and anything else defaults to processing
    return 'processing';
};
