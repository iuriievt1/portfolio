import { describe, expect, it } from 'vitest'
import { getImageUrl, resolveContinueWatchingImage, resolveImageUrl } from '../image'
import type { Item } from '../types'

const BASE_URL = 'https://images.example.com'

describe('getImageUrl', () => {
	const baseItem = {
		Id: 'PROGRAM_123_ABC',
		ImageBucketId: 'bucket-1',
		SupportedImages: ['16x9/poster', '16x9/keyart', '2x3/poster'],
	}

	it('resolves first matching preference and slugifies ID', () => {
		const url = getImageUrl({
			baseImageServiceUrl: BASE_URL,
			item: baseItem,
			itemType: 'program',
			ratio: '16x9',
			size: 'medium',
			imageTypePreference: ['poster', 'keyart'],
			extension: 'jpg',
		})

		expect(url).toBe(`${BASE_URL}/bucket-1/program/program-123-abc/16x9/postermedium.jpg`)
	})

	it('falls back to next preference when first unavailable', () => {
		const url = getImageUrl({
			baseImageServiceUrl: BASE_URL,
			item: { ...baseItem, SupportedImages: ['16x9/keyart'] },
			itemType: 'series',
			ratio: '16x9',
			size: 'large',
			imageTypePreference: ['poster', 'keyart'],
			extension: 'jpg',
		})

		expect(url).toBe(`${BASE_URL}/bucket-1/series/program-123-abc/16x9/keyartlarge.jpg`)
	})

	it('returns empty string when no images match ratio', () => {
		const url = getImageUrl({
			baseImageServiceUrl: BASE_URL,
			item: { ...baseItem, SupportedImages: ['2x3/poster'] },
			itemType: 'program',
			ratio: '16x9',
			size: 'medium',
			imageTypePreference: ['poster'],
			extension: 'jpg',
		})

		expect(url).toBe('')
	})
})

describe('resolveImageUrl', () => {
	const makeItem = (overrides: Partial<Item> = {}): Item => ({
		Id: 'ITEM_1',
		Name: 'Test Item',
		ItemType: 'Program',
		ShowType: 'Movie',
		SupportedImages: ['16x9/poster', '16x9/keyart', '2x3/poster'],
		ImageBucketId: 'bucket-1',
		IsAdult: false,
		IsGeneric: false,
		...overrides,
	})

	it('uses xxxlarge hero images for the hero layout', () => {
		const url = resolveImageUrl(
			BASE_URL,
			makeItem({ SupportedImages: ['16x9/carousel1', '16x9/keyart', '2x3/poster'] }),
			'hero',
		)

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/16x9/carousel1xxxlarge.jpg`)
	})

	// MK generates 4x3/3x4 as keyart only, up to xxlarge — verified against the "Dotscreen" feed.
	it('uses the declared 4x3 and 3x4 artwork at xlarge', () => {
		const item = makeItem({ SupportedImages: ['16x9/keyart', '2x3/keyart', '4x3/keyart', '3x4/keyart'] })

		expect(resolveImageUrl(BASE_URL, item, '4x3')).toBe(`${BASE_URL}/bucket-1/program/item-1/4x3/keyartxlarge.jpg`)
		expect(resolveImageUrl(BASE_URL, item, '3x4')).toBe(`${BASE_URL}/bucket-1/program/item-1/3x4/keyartxlarge.jpg`)
	})

	it('falls back to the nearest orientation when the item has no 4x3 or 3x4 artwork', () => {
		const landscapeOnly = makeItem({ SupportedImages: ['16x9/poster'] })
		const portraitOnly = makeItem({ SupportedImages: ['2x3/poster'] })

		expect(resolveImageUrl(BASE_URL, landscapeOnly, '4x3')).toBe(
			`${BASE_URL}/bucket-1/program/item-1/16x9/posterxlarge.jpg`,
		)
		expect(resolveImageUrl(BASE_URL, portraitOnly, '3x4')).toBe(
			`${BASE_URL}/bucket-1/program/item-1/2x3/posterxlarge.jpg`,
		)
	})

	it('uses xlarge backdrop images for rail layouts', () => {
		const url = resolveImageUrl(BASE_URL, makeItem(), 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/16x9/posterxlarge.jpg`)
	})

	it('returns empty string when no image matches (API mode renders a neutral placeholder)', () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: [] }), 'hero')

		expect(url).toBe('')
	})

	it("falls back to 1x1 image (xxlarge — the only 1x1 size) for 'hero' when no 16x9 is available", () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['1x1/keyart'] }), 'hero')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/1x1/keyartxxlarge.jpg`)
	})

	it("falls back to 1x1 image (xxlarge) for 'backdrop' when no 16x9 is available", () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['1x1/poster'] }), 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/1x1/posterxxlarge.jpg`)
	})

	it("falls back to 1x1 image (xxlarge) for 'poster' when no 2x3 is available", () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['1x1/keyart'] }), 'poster')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/1x1/keyartxxlarge.jpg`)
	})

	// A 16x9-only item in a backend-declared 2x3 rail used to render a blank card.
	it('falls back to 16x9 for a poster rail when the item has no 2x3 or 1x1', () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['16x9/poster'] }), 'poster')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/16x9/posterxlarge.jpg`)
	})

	it('falls back to 2x3 for a backdrop rail when the item has no 16x9 or 1x1', () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['2x3/keyart'] }), 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/2x3/keyartxlarge.jpg`)
	})

	// A portrait poster stretched across a 16x9 continue-watching card is the worst fallback.
	it('prefers 4x3 over 2x3 when filling a 16x9 card', () => {
		const item = makeItem({ SupportedImages: ['2x3/poster', '4x3/keyart'] })
		const url = resolveImageUrl(BASE_URL, item, 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/4x3/keyartxlarge.jpg`)
	})

	it('prefers 3x4 over 16x9 when filling a 2x3 card', () => {
		const item = makeItem({ SupportedImages: ['16x9/poster', '3x4/keyart'] })
		const url = resolveImageUrl(BASE_URL, item, 'poster')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/3x4/keyartxlarge.jpg`)
	})

	it('prefers 1x1 over the other fallback ratios', () => {
		const item = makeItem({ SupportedImages: ['16x9/poster', '1x1/keyart'] })
		const url = resolveImageUrl(BASE_URL, item, 'poster')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/1x1/keyartxxlarge.jpg`)
	})

	it('prefers the layout ratio over the 1x1 fallback when both are available', () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: ['16x9/poster', '1x1/keyart'] }), 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-1/program/item-1/16x9/posterxlarge.jpg`)
	})

	it("uses 1x1 keyart xxlarge under the 'person' path segment for the 'player' layout", () => {
		const url = resolveImageUrl(
			BASE_URL,
			makeItem({
				Id: 'ce90f632-40cb-4138-8a98-3df411018b5c',
				SupportedImages: ['1x1/KeyArt'],
			}),
			'player',
		)

		expect(url).toBe(`${BASE_URL}/bucket-1/person/ce90f632-40cb-4138-8a98-3df411018b5c/1x1/keyartxxlarge.jpg`)
	})

	it("returns empty string for the 'player' layout when no 1x1 image is supported", () => {
		const url = resolveImageUrl(BASE_URL, makeItem({ SupportedImages: [] }), 'player')

		expect(url).toBe('')
	})

	// Live channels only ever expose 4x3 PNG logos under a `station/` path.
	const makeChannel = (overrides: Partial<Item> = {}): Item =>
		makeItem({
			Id: '14098',
			Name: 'KTVU-2 (FOX)',
			ItemType: 'Channel',
			ShowType: '',
			SupportedImages: ['4x3/Logo', '4x3/Icon'],
			ImageBucketId: undefined,
			...overrides,
		})

	it('resolves a live-channel logo as a 4x3 png under the station path', () => {
		const url = resolveImageUrl(BASE_URL, makeChannel(), 'backdrop')

		expect(url).toBe(`${BASE_URL}/images/station/14098/4x3/iconlarge.png`)
	})

	it('uses the same channel logo regardless of the requested layout', () => {
		for (const layout of ['hero', 'backdrop', 'poster', 'character'] as const) {
			expect(resolveImageUrl(BASE_URL, makeChannel(), layout)).toBe(
				`${BASE_URL}/images/station/14098/4x3/iconlarge.png`,
			)
		}
	})

	it('falls back to the logo image type when a channel has no icon', () => {
		const url = resolveImageUrl(BASE_URL, makeChannel({ SupportedImages: ['4x3/Logo'] }), 'backdrop')

		expect(url).toBe(`${BASE_URL}/images/station/14098/4x3/logolarge.png`)
	})

	it('keeps an explicit ImageBucketId when the channel payload carries one', () => {
		const url = resolveImageUrl(BASE_URL, makeChannel({ ImageBucketId: 'bucket-9' }), 'backdrop')

		expect(url).toBe(`${BASE_URL}/bucket-9/station/14098/4x3/iconlarge.png`)
	})

	it('returns empty string for a channel with no artwork at all', () => {
		const url = resolveImageUrl(BASE_URL, makeChannel({ Id: '11345', SupportedImages: undefined }), 'backdrop')

		expect(url).toBe('')
	})
})

describe('resolveContinueWatchingImage', () => {
	// Verified against /v5/libraries/Continue: every URI in `Images` is a ~180px portrait file,
	// including the ones named `KeyArtLandscape`. The card-sized artwork is a sibling path.
	const IMAGES = [
		{ Uri: `${BASE_URL}/images/title/tenant1-667969thirdparty343031/posterlandscapesmall.png` },
		{ Uri: `${BASE_URL}/images/title/tenant1-667969thirdparty343031/keyartlandscapemedium.jpg` },
	]

	it('addresses the 16x9 artwork beside the thumbnails', () => {
		const url = resolveContinueWatchingImage({
			images: IMAGES,
			supportedImages: ['4x3/KeyArt', '2x3/Poster', '16x9/KeyArt', 'PosterLandscape'],
		})

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-667969thirdparty343031/16x9/keyartxlarge.jpg`)
	})

	it('falls back to the nearest declared ratio when the item has no 16x9', () => {
		const url = resolveContinueWatchingImage({ images: IMAGES, supportedImages: ['4x3/KeyArt', '2x3/Poster'] })

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-667969thirdparty343031/4x3/keyartxlarge.jpg`)
	})

	// Real payload for "0806-sample test" — a 2x3 poster is the only artwork MK holds for it.
	it('uses the 2x3 poster when that is all the item declares', () => {
		const url = resolveContinueWatchingImage({ images: IMAGES, supportedImages: ['2x3/Poster', 'PosterLandscape'] })

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-667969thirdparty343031/2x3/posterxlarge.jpg`)
	})

	// MK omits `Images` entirely on some library items — the path is then built from the item's id.
	it('builds the path from the item id when MK returns no thumbnails', () => {
		const url = resolveContinueWatchingImage({
			supportedImages: ['16x9/Carousel1', '16x9/Poster', '16x9/KeyArt'],
			universalProgramId: 'tenant1_fake_ts-1171p_engage_movie',
			imageBucketId: 'images',
			imageBaseUrl: BASE_URL,
		})

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-fake-ts-1171p-engage-movie/16x9/posterxlarge.jpg`)
	})

	it('falls back to carousel1 when that is the only 16x9 artwork', () => {
		const url = resolveContinueWatchingImage({
			supportedImages: ['16x9/Carousel1'],
			universalProgramId: 'tenant1_fake_ts-1171p_engage_movie',
			imageBucketId: 'images',
			imageBaseUrl: BASE_URL,
		})

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-fake-ts-1171p-engage-movie/16x9/carousel1xlarge.jpg`)
	})

	it('prefers the thumbnail directory over the constructed one when both are available', () => {
		const url = resolveContinueWatchingImage({
			images: IMAGES,
			supportedImages: ['16x9/KeyArt'],
			universalProgramId: 'tenant1_fake_ts-1171p_engage_movie',
			imageBucketId: 'images',
			imageBaseUrl: BASE_URL,
		})

		expect(url).toBe(`${BASE_URL}/images/title/tenant1-667969thirdparty343031/16x9/keyartxlarge.jpg`)
	})

	it('returns empty when no ratio is declared or nothing locates the directory', () => {
		expect(resolveContinueWatchingImage({ images: IMAGES, supportedImages: ['PosterLandscape'] })).toBe('')
		expect(resolveContinueWatchingImage({ images: [], supportedImages: ['16x9/KeyArt'] })).toBe('')
		expect(resolveContinueWatchingImage({})).toBe('')
		// An id with no base url (or the reverse) cannot make a path.
		expect(
			resolveContinueWatchingImage({
				supportedImages: ['16x9/KeyArt'],
				universalProgramId: 'tenant1_fake_ts-1171p_engage_movie',
			}),
		).toBe('')
	})
})
