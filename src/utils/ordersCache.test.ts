import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCachedOrders, setCachedOrders, invalidateOrdersCache } from './ordersCache'
import type { Order } from '../components/TransactionPopup'

// Mock the API client so ordersCache module loads without network
vi.mock('../api/client', () => ({
    default: { get: vi.fn() },
}))

const makeOrder = (id: string): Order => ({
    id,
    status: 'completed',
    amountStableCoin: 10,
    amountNgn: 14600,
    coin: 'USDC',
    createdAt: new Date().toISOString(),
    trnxWallet: '0xabc',
    type: 'offramp',
} as unknown as Order)

describe('getCachedOrders / setCachedOrders', () => {
    beforeEach(() => {
        localStorage.clear()
        invalidateOrdersCache()
    })

    it('returns null when nothing is cached', () => {
        expect(getCachedOrders()).toBeNull()
    })

    it('returns cached data when fresh', () => {
        const orders = [makeOrder('1'), makeOrder('2')]
        setCachedOrders(orders, true)
        const result = getCachedOrders()
        expect(result).not.toBeNull()
        expect(result!.orders).toHaveLength(2)
        expect(result!.fullFetch).toBe(true)
    })

    it('returns null and removes key when cache is expired', () => {
        const orders = [makeOrder('1')]
        setCachedOrders(orders, false)

        // Manually set an expired timestamp in localStorage
        const cacheKey = 'cachedOrders'
        const stored = JSON.parse(localStorage.getItem(cacheKey)!)
        stored.timestamp = Date.now() - 10 * 60 * 1000 // 10 minutes ago
        localStorage.setItem(cacheKey, JSON.stringify(stored))

        expect(getCachedOrders()).toBeNull()
        expect(localStorage.getItem(cacheKey)).toBeNull()
    })

    it('returns null (no throw) for corrupted JSON in localStorage', () => {
        localStorage.setItem('cachedOrders', '{bad json}}}')
        expect(() => getCachedOrders()).not.toThrow()
        expect(getCachedOrders()).toBeNull()
    })

    it('invalidateOrdersCache clears the cache', () => {
        setCachedOrders([makeOrder('1')], true)
        invalidateOrdersCache()
        expect(getCachedOrders()).toBeNull()
    })
})
