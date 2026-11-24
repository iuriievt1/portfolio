import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDataSource, optionalEnv, requireEnv } from '../env'

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('requireEnv', () => {
	it('throws on missing env var', () => {
		vi.stubEnv('DATA_SOURCE', '')
		expect(() => requireEnv('DATA_SOURCE')).toThrow('Missing required env var: DATA_SOURCE')
	})

	it('returns value when present', () => {
		vi.stubEnv('MK_API_HOST', 'https://api.example.com')
		expect(requireEnv('MK_API_HOST')).toBe('https://api.example.com')
	})
})

describe('optionalEnv', () => {
	it('returns null when missing', () => {
		delete process.env.MK_API_HOST
		expect(optionalEnv('MK_API_HOST')).toBeNull()
	})

	it('returns value when present', () => {
		vi.stubEnv('MK_API_HOST', 'https://api.example.com')
		expect(optionalEnv('MK_API_HOST')).toBe('https://api.example.com')
	})
})

describe('getDataSource', () => {
	it('returns "mock" by default', () => {
		delete process.env.DATA_SOURCE
		expect(getDataSource()).toBe('mock')
	})

	it('returns "api" when set', () => {
		vi.stubEnv('DATA_SOURCE', 'api')
		expect(getDataSource()).toBe('api')
	})

	it('returns "mock" when set', () => {
		vi.stubEnv('DATA_SOURCE', 'mock')
		expect(getDataSource()).toBe('mock')
	})

	it('throws on invalid value', () => {
		vi.stubEnv('DATA_SOURCE', 'invalid')
		expect(() => getDataSource()).toThrow('Invalid DATA_SOURCE="invalid"')
	})
})
