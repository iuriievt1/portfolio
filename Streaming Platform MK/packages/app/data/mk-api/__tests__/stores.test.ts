import { describe, expect, it } from 'vitest'
import { filterVisibleStores, storeLabelFromId } from '../stores'

describe('storeLabelFromId', () => {
	it('takes everything after the last separator', () => {
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!Main')).toBe('Main')
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!New Demo App')).toBe('New Demo App')
	})

	it('keeps spaces inside the label', () => {
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!IBC Demo 2026')).toBe('IBC Demo 2026')
	})

	it('splits on the LAST separator, not the first', () => {
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!nested!Deep Store')).toBe('Deep Store')
	})

	it('returns the id unchanged when there is no separator', () => {
		expect(storeLabelFromId('PlainStoreId')).toBe('PlainStoreId')
	})

	it('trims surrounding whitespace', () => {
		expect(storeLabelFromId('  HubsAndFeeds-!tenant1!Main  ')).toBe('Main')
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!  Main  ')).toBe('Main')
	})

	it('falls back to the full id when the trailing segment is empty', () => {
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!')).toBe('HubsAndFeeds-!tenant1!')
		expect(storeLabelFromId('HubsAndFeeds-!tenant1!   ')).toBe('HubsAndFeeds-!tenant1!')
	})

	it('handles an empty string', () => {
		expect(storeLabelFromId('')).toBe('')
		expect(storeLabelFromId('   ')).toBe('')
	})

	it('handles a bare separator', () => {
		expect(storeLabelFromId('!')).toBe('!')
	})
})

describe('filterVisibleStores', () => {
	const stores = [
		{ id: 'HubsAndFeeds-!tenant1!Main', label: 'Main' },
		{ id: 'HubsAndFeeds-!tenant1!New Demo App', label: 'New Demo App' },
		{ id: 'HubsAndFeeds-!tenant1!IBC Sports', label: 'IBC Sports' },
	]

	it('keeps every store when the allowlist is empty', () => {
		expect(filterVisibleStores(stores, [])).toEqual(stores)
	})

	it('keeps only the stores whose label is allowed', () => {
		expect(filterVisibleStores(stores, ['IBC Sports'])).toEqual([stores[2]])
	})

	it('matches labels case-insensitively and ignores surrounding whitespace', () => {
		expect(filterVisibleStores(stores, ['  ibc sports  '])).toEqual([stores[2]])
	})

	it('also accepts a full store id', () => {
		expect(filterVisibleStores(stores, ['HubsAndFeeds-!tenant1!New Demo App'])).toEqual([stores[1]])
	})

	it('keeps the configured order of the store list, not of the allowlist', () => {
		expect(filterVisibleStores(stores, ['IBC Sports', 'Main'])).toEqual([stores[0], stores[2]])
	})

	it('falls back to the full list when the allowlist matches nothing', () => {
		expect(filterVisibleStores(stores, ['Typo Store'])).toEqual(stores)
	})

	it('ignores blank allowlist entries', () => {
		expect(filterVisibleStores(stores, ['', '   ', 'Main'])).toEqual([stores[0]])
	})

	it('handles an empty store list', () => {
		expect(filterVisibleStores([], ['IBC Sports'])).toEqual([])
	})
})
