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
    ])('maps "%s" to "failed"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it.each([
        ['refunded', 'refunded'],
        ['fiat refunded', 'refunded'],
    ])('maps "%s" to "refunded"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it.each([
        ['awaiting_payment', 'initiated'],
        ['awaiting payment', 'initiated'],
    ])('maps "%s" to "initiated"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it.each([
        ['pending', 'processing'],
        ['initiated', 'processing'],
        ['created', 'processing'],
        ['fiat received', 'processing'],
        ['unknown_state', 'processing'],
    ])('maps "%s" to "processing"', (input, expected) => {
        expect(mapTransactionStatus(input)).toBe(expected)
    })

    it('is case-insensitive', () => {
        expect(mapTransactionStatus('DISBURSED')).toBe('completed')
        expect(mapTransactionStatus('Failed')).toBe('failed')
        expect(mapTransactionStatus('REFUNDED')).toBe('refunded')
    })
})
