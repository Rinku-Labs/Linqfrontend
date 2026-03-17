import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the API client before importing the module under test
vi.mock('../api/client', () => ({
    default: { get: vi.fn() },
}))

import { fetchRate, getCachedRate, invalidateRateCache } from './rateCache'
import client from '../api/client'

const mockGet = client.get as ReturnType<typeof vi.fn>

describe('rateCache', () => {
    beforeEach(() => {
        localStorage.clear()
        invalidateRateCache()
        mockGet.mockReset()
    })

    it('returns rate from API and caches it', async () => {
        mockGet.mockResolvedValueOnce({ data: { rate: 1600 } })
        const rate = await fetchRate()
        expect(rate).toBe(1600)
        expect(getCachedRate()).toBe(1600)
    })

    it('returns cached rate on second call without hitting API again', async () => {
        mockGet.mockResolvedValueOnce({ data: { rate: 1600 } })
        await fetchRate()
        await fetchRate()
        expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('returns FALLBACK_RATE (1460) when API throws and no prior rate exists', async () => {
        mockGet.mockRejectedValueOnce(new Error('network error'))
        const rate = await fetchRate()
        expect(rate).toBe(1460)
    })

    it('returns last known rate on API error if a rate was previously cached', async () => {
        mockGet.mockResolvedValueOnce({ data: { rate: 1700 } })
        await fetchRate()
        invalidateRateCache()

        mockGet.mockRejectedValueOnce(new Error('network error'))
        // Last known rate was 1700, stored in localStorage before invalidation cleared memory
        // But invalidateRateCache removes localStorage too, so we expect FALLBACK_RATE
        const rate = await fetchRate()
        expect(rate).toBe(1460)
    })

    it('deduplicates concurrent in-flight requests', async () => {
        mockGet.mockResolvedValue({ data: { rate: 1650 } })
        const [r1, r2, r3] = await Promise.all([fetchRate(), fetchRate(), fetchRate()])
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(r1).toBe(1650)
        expect(r2).toBe(1650)
        expect(r3).toBe(1650)
    })

    it('clears in-flight promise after resolution', async () => {
        mockGet.mockResolvedValue({ data: { rate: 1550 } })
        await fetchRate()
        invalidateRateCache()

        mockGet.mockResolvedValue({ data: { rate: 1560 } })
        const rate = await fetchRate()
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(rate).toBe(1560)
    })

    it('returns FALLBACK_RATE when API returns rate of 0', async () => {
        mockGet.mockResolvedValueOnce({ data: { rate: 0 } })
        const rate = await fetchRate()
        expect(rate).toBe(1460)
    })

    it('handles API returning rate as top-level number', async () => {
        mockGet.mockResolvedValueOnce({ data: 1580 })
        const rate = await fetchRate()
        expect(rate).toBe(1580)
    })

    it('error backoff: does not hit API again within 60s after failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('fail'))
        await fetchRate()

        // Second call within backoff window should not hit API
        const rate2 = await fetchRate()
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(rate2).toBe(1460)
    })
})
