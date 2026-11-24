import { describe, expect, it, vi } from 'vitest'
import { parseMkAccounts } from '../client-env'

describe('parseMkAccounts', () => {
	it('returns an empty list when unset', () => {
		expect(parseMkAccounts(undefined)).toEqual([])
		expect(parseMkAccounts('')).toEqual([])
		expect(parseMkAccounts('   ')).toEqual([])
	})

	it('parses a comma-separated token list', () => {
		expect(parseMkAccounts('tok-a, tok-b ,tok-c')).toEqual([{ token: 'tok-a' }, { token: 'tok-b' }, { token: 'tok-c' }])
	})

	it('drops empty entries in a comma-separated list', () => {
		expect(parseMkAccounts('tok-a,,  ,tok-b')).toEqual([{ token: 'tok-a' }, { token: 'tok-b' }])
	})

	it('parses a JSON array of objects and keeps optional overrides', () => {
		const raw = '[{"token":"tok-a"},{"token":"tok-b","name":"Ryan Andrew","avatarUrl":"/a.png"}]'
		expect(parseMkAccounts(raw)).toEqual([
			{ token: 'tok-a' },
			{ token: 'tok-b', name: 'Ryan Andrew', avatarUrl: '/a.png' },
		])
	})

	it('parses a JSON array of bare token strings', () => {
		expect(parseMkAccounts('["tok-a","tok-b"]')).toEqual([{ token: 'tok-a' }, { token: 'tok-b' }])
	})

	it('drops JSON entries without a usable token instead of throwing', () => {
		const raw = '[{"token":"tok-a"},{"name":"No Token"},null,42,{"token":"   "}]'
		expect(parseMkAccounts(raw)).toEqual([{ token: 'tok-a' }])
	})

	it('omits blank name and avatarUrl overrides', () => {
		expect(parseMkAccounts('[{"token":"tok-a","name":"  ","avatarUrl":""}]')).toEqual([{ token: 'tok-a' }])
	})

	it('returns an empty list on malformed JSON without throwing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		expect(parseMkAccounts('[{"token": ')).toEqual([])
		expect(warn).toHaveBeenCalled()
		warn.mockRestore()
	})

	it('returns an empty list when JSON is not an array', () => {
		expect(parseMkAccounts('[]')).toEqual([])
	})
})
