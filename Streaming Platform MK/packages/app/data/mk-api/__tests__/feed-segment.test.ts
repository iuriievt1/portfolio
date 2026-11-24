import { describe, expect, it } from 'vitest'
import { splitFeedSegment } from '../provider'

const params = (segment: string) => Object.fromEntries(splitFeedSegment(segment).extraParams)

describe('splitFeedSegment', () => {
	it('leaves a plain feed id untouched', () => {
		const { feedId, extraParams } = splitFeedSegment('events')
		expect(feedId).toBe('events')
		expect([...extraParams]).toEqual([])
	})

	it('splits a feed id that carries a filter query', () => {
		expect(splitFeedSegment('movies/?Genre=2715').feedId).toBe('movies')
		expect(params('movies/?Genre=2715')).toEqual({ Genre: '2715' })
	})

	it('handles multiple filter params', () => {
		expect(params('movies/?Genre=2715&Year=2026')).toEqual({ Genre: '2715', Year: '2026' })
	})

	it('strips the trailing slash from the path part', () => {
		expect(splitFeedSegment('movies/').feedId).toBe('movies')
		expect(splitFeedSegment('movies/?Genre=1').feedId).toBe('movies')
	})

	it('keeps GUID feed ids intact', () => {
		const guid = '706935ec-755a-4ceb-b80d-47c130d72e0e'
		expect(splitFeedSegment(guid).feedId).toBe(guid)
	})

	it('handles a trailing question mark with no params', () => {
		expect(splitFeedSegment('movies/?').feedId).toBe('movies')
		expect(params('movies/?')).toEqual({})
	})

	it('splits on the first question mark only', () => {
		expect(splitFeedSegment('movies/?a=1?b=2').feedId).toBe('movies')
	})

	it('handles an empty segment', () => {
		expect(splitFeedSegment('').feedId).toBe('')
	})
})
