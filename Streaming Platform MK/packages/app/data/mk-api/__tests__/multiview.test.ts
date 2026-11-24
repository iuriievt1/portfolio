import { describe, expect, it } from 'vitest'
import { isMultiviewMediaId, multiviewFeedCount, multiviewGroupKey, multiviewSpotlightKey } from '../multiview'

describe('multiviewGroupKey', () => {
	// MK ships one channel per spotlight, named with a trailing letter off a shared base.
	it('folds the spotlight variants of one mosaic onto a single key', () => {
		expect(multiviewGroupKey('mv-test-3us-b')).toBe('mv-test-3us')
		expect(multiviewGroupKey('mv-test-3us-c')).toBe('mv-test-3us')
		expect(multiviewGroupKey('MV-Test-3us-B')).toBe('mv-test-3us')
	})

	it('leaves a mosaic that has no spotlight variants alone', () => {
		expect(multiviewGroupKey('mv-test-3us')).toBe('mv-test-3us')
		expect(multiviewGroupKey('mv-test')).toBe('mv-test')
		// The feed-count suffix must not read as a spotlight letter.
		expect(multiviewGroupKey('mv-test-2up')).toBe('mv-test-2up')
		expect(multiviewGroupKey('mv-4-up')).toBe('mv-4-up')
	})

	it('is empty for a channel with no mediaId', () => {
		expect(multiviewGroupKey(undefined)).toBe('')
		expect(multiviewGroupKey('')).toBe('')
	})
})

describe('multiviewSpotlightKey', () => {
	it('reads the spotlighted feed off the trailing letter', () => {
		expect(multiviewSpotlightKey('mv-test-3us-b')).toBe('B')
		expect(multiviewSpotlightKey('mv-test-3us-c')).toBe('C')
		expect(multiviewSpotlightKey('MV-Test-3us-B')).toBe('B')
	})

	// The base variant carries no letter, and the feed keys start at A.
	it('treats the unlettered base as the first feed', () => {
		expect(multiviewSpotlightKey('mv-test-3us')).toBe('A')
		expect(multiviewSpotlightKey('mv-test')).toBe('A')
		expect(multiviewSpotlightKey('mv-test-2up')).toBe('A')
	})
})

describe('isMultiviewMediaId', () => {
	it('recognises the known mosaic stream', () => {
		expect(isMultiviewMediaId('mv-test')).toBe(true)
	})

	// MK adds mosaics without telling us; an `mv-` stream must work without a code change.
	it('recognises any mv-prefixed stream', () => {
		expect(isMultiviewMediaId('mv-2up')).toBe(true)
		expect(isMultiviewMediaId('mv_3up')).toBe(true)
		expect(isMultiviewMediaId('MV-Test-2')).toBe(true)
	})

	it('leaves ordinary channels alone', () => {
		expect(isMultiviewMediaId('ktvu-hd')).toBe(false)
		expect(isMultiviewMediaId('movie-mv-extra')).toBe(false)
		expect(isMultiviewMediaId(undefined)).toBe(false)
		expect(isMultiviewMediaId('')).toBe(false)
	})
})

describe('multiviewFeedCount', () => {
	it('keeps the known stream at its real count', () => {
		expect(multiviewFeedCount('mv-test')).toBe(4)
	})

	// MK named the 3-up mosaic `mv-test-3us`, so the name cannot be read for a count.
	it('keeps the misnamed 3-up mosaic at its real count', () => {
		expect(multiviewFeedCount('mv-test-3us')).toBe(3)
		expect(multiviewFeedCount('MV-Test-3us', 'KTVU-2 (FOX)', 'KTVU')).toBe(3)
	})

	it('reads the count out of the stream name', () => {
		expect(multiviewFeedCount('mv-2up')).toBe(2)
		expect(multiviewFeedCount('mv_3up')).toBe(3)
		expect(multiviewFeedCount('mv-4-up')).toBe(4)
	})

	it('falls back to the later parts when the mediaId does not say', () => {
		expect(multiviewFeedCount('mv-alpha', 'Sports MV 3-up')).toBe(3)
		expect(multiviewFeedCount('mv-alpha', undefined, 'MV2UP')).toBe(2)
	})

	// Better no badge than a wrong one — the player still finds the real count from the audio feeds.
	it('returns undefined when nothing names a plausible count', () => {
		expect(multiviewFeedCount('mv-alpha')).toBeUndefined()
		expect(multiviewFeedCount('mv-1up')).toBeUndefined()
		expect(multiviewFeedCount('mv-9up')).toBeUndefined()
		expect(multiviewFeedCount(undefined)).toBeUndefined()
	})
})
