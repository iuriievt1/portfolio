import { describe, expect, it } from 'vitest'
import { fallbackVariantFromImages, feedRendersAsSquare } from '../provider'
import type { DiscoveryFeedItemsResponse, Item } from '../types'

const makeItem = (supportedImages: string[]): Item => ({
	Id: 'ITEM_1',
	Name: 'Test Item',
	ItemType: 'Program',
	ShowType: 'Movie',
	SupportedImages: supportedImages,
	ImageBucketId: 'bucket-1',
	IsAdult: false,
	IsGeneric: false,
})

/** Real "On Now" payload shape: live channels come back with no `SupportedImages` key at all. */
const itemWithoutImages: Item = {
	Id: '11345',
	Name: 'KTVU-HD-2 (FOX)',
	ItemType: 'Channel',
	ShowType: '',
	ImageBucketId: '',
	IsAdult: false,
	IsGeneric: false,
}

const response = (items: Item[]): DiscoveryFeedItemsResponse => ({ Uri: null, Items: items })

describe('feedRendersAsSquare', () => {
	it('is true when every item only exposes 1x1 images', () => {
		expect(feedRendersAsSquare(response([makeItem(['1x1/Poster']), makeItem(['1x1/KeyArt'])]))).toBe(true)
	})

	it('is true for a "Club Logos"-style feed where items carry both 16x9 and 1x1', () => {
		expect(feedRendersAsSquare(response([makeItem(['16x9/Poster', '1x1/Poster']), makeItem(['1x1/Poster'])]))).toBe(
			true,
		)
	})

	it('is false when an item exposes artwork but no 1x1', () => {
		expect(feedRendersAsSquare(response([makeItem(['1x1/Poster']), makeItem(['16x9/Poster'])]))).toBe(false)
	})

	it('is false when no item exposes a 1x1 image', () => {
		expect(feedRendersAsSquare(response([makeItem(['16x9/Poster']), makeItem(['2x3/Poster'])]))).toBe(false)
	})

	it('is false for an empty feed', () => {
		expect(feedRendersAsSquare(response([]))).toBe(false)
	})

	it('ignores items with no artwork and still detects a square rail', () => {
		expect(feedRendersAsSquare(response([makeItem([]), makeItem(['1x1/Poster'])]))).toBe(true)
	})

	// Live-channel items ("On Now" custom feeds) omit SupportedImages entirely — this used to
	// throw and silently drop the whole rail.
	it('ignores items where SupportedImages is missing', () => {
		expect(feedRendersAsSquare(response([itemWithoutImages, makeItem(['1x1/Poster'])]))).toBe(true)
	})
})

describe('fallbackVariantFromImages', () => {
	it('returns character for a square rail', () => {
		expect(fallbackVariantFromImages(response([makeItem(['1x1/Poster'])]))).toBe('character')
	})

	it('returns character when a Mixed feed item carries both 16x9 and 1x1', () => {
		expect(fallbackVariantFromImages(response([makeItem(['16x9/Poster', '1x1/Poster'])]))).toBe('character')
	})

	it('returns poster only when every item has a 2x3 image', () => {
		expect(fallbackVariantFromImages(response([makeItem(['2x3/Poster']), makeItem(['2x3/KeyArt'])]))).toBe('poster')
	})

	// A single 2x3 item used to turn the whole rail portrait, blanking the 16x9-only cards.
	it('returns backdrop when only some items have a 2x3 image', () => {
		expect(fallbackVariantFromImages(response([makeItem(['2x3/Poster']), makeItem(['16x9/Poster'])]))).toBe('backdrop')
	})

	it('returns backdrop for 16x9 feeds without 2x3 or 1x1', () => {
		expect(fallbackVariantFromImages(response([makeItem(['16x9/Poster'])]))).toBe('backdrop')
	})

	it('does not throw on a live-channel feed where an item has no SupportedImages', () => {
		expect(fallbackVariantFromImages(response([makeItem(['4x3/Logo', '4x3/Icon']), itemWithoutImages]))).toBe(
			'backdrop',
		)
	})
})
