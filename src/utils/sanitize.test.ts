import { describe, it, expect } from 'vitest'
import { sanitizeInput, trimInput } from './sanitize'

describe('sanitizeInput', () => {
    it('strips HTML tags', () => {
        expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")')
    })

    it('strips inline HTML elements', () => {
        expect(sanitizeInput('<b>bold</b>')).toBe('bold')
    })

    it('returns plain text unchanged', () => {
        expect(sanitizeInput('hello world')).toBe('hello world')
    })

    it('handles empty string', () => {
        expect(sanitizeInput('')).toBe('')
    })

    it('strips nested tags', () => {
        expect(sanitizeInput('<div><p>text</p></div>')).toBe('text')
    })

    it('returns non-string input as-is', () => {
        // @ts-expect-error testing runtime guard
        expect(sanitizeInput(42)).toBe(42)
    })
})

describe('trimInput', () => {
    it('trims leading and trailing whitespace', () => {
        expect(trimInput('  hello  ')).toBe('hello')
    })

    it('leaves plain string unchanged', () => {
        expect(trimInput('hello')).toBe('hello')
    })

    it('returns empty string for whitespace-only input', () => {
        expect(trimInput('   ')).toBe('')
    })

    it('returns non-string input as-is', () => {
        // @ts-expect-error testing runtime guard
        expect(trimInput(99)).toBe(99)
    })
})
