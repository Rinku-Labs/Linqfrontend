import { describe, it, expect } from 'vitest'
import { mapTransactionStatus } from './statusMapping'

describe('mapTransactionStatus', () => {
    it.each([
        ['disbursed', 'completed'],
        ['completed', 'completed'],
        ['success', 'completed'],
        ['received_in_treasury', 'completed'],
        ['settled in treasury', 'completed'],
        ['crypto confirmed', 'completed'],
        ['processing: treasury worker on it..', 'completed'],
    ])('maps "%s" to "completed"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it.each([
        ['failed', 'failed'],
        ['expired', 'failed'],
        ['rejected', 'failed'],
        ['timeout: no deposit received', 'failed'],
        ['failed to send transaction', 'failed'],
        ['transaction failed', 'failed'],
        ['cancelled', 'failed'],
        ['refunded', 'failed'],
        ['fiat refunded', 'failed'],
        ['bill refunded', 'failed'],
    ])('maps "%s" to "failed"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it.each([
        ['pending', 'pending'],
        ['initiated', 'pending'],
        ['created', 'pending'],
        ['fiat received', 'pending'],
        ['awaiting_payment', 'pending'],
        ['awaiting payment', 'pending'],
        ['processing', 'pending'],
        ['in_order_queue', 'pending'],
        ['payment_processing', 'pending'],
        ['unknown_state', 'pending'],
    ])('maps "%s" to "pending"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it('is case-insensitive', () => {
        expect(mapTransactionStatus('DISBURSED')).toBe('completed')
        expect(mapTransactionStatus('Failed')).toBe('failed')
        expect(mapTransactionStatus('REFUNDED')).toBe('failed')
        expect(mapTransactionStatus('PENDING')).toBe('pending')
    })
})
