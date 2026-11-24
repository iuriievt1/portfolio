import type { Item } from './types'

/** Converts item ID to URL-safe slug (lowercase, underscores → hyphens). */
function itemIdToImageSlug(id: string) {
	return id.toLowerCase().replace(/_/g, '-')
}

/** Live channels omit `ImageBucketId`; every other item type returns this same bucket. */
const DEFAULT_IMAGE_BUCKET = 'images'

export function getImageUrl(data: {
	baseImageServiceUrl: string
	item: { Id: string; ImageBucketId?: string; SupportedImages?: string[] }
	itemType: 'program' | 'series' | 'person' | 'station' | 'title'
	ratio: string
	size: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge'
	imageTypePreference: string[]
	extension: 'jpg' | 'png'
	/** Artwork directory, for items whose id does not map to one (Continue Watching). */
	baseDir?: string
}): string {
	const supportedImagesWithRatio = (data.item.SupportedImages || [])
		.map((s) => s.toLowerCase().split('/'))
		.filter(([ratio]) => ratio === data.ratio)

	if (!supportedImagesWithRatio.length) return ''

	const imagePath = itemIdToImageSlug(data.item.Id || '')
	const dir =
		data.baseDir ?? `${data.baseImageServiceUrl}/${data.item.ImageBucketId || ''}/${data.itemType}/${imagePath}`
	let imageUrl = ''

	for (const preferredImageType of data.imageTypePreference) {
		const match = supportedImagesWithRatio.filter(
			([, imageType]) => preferredImageType.toLowerCase() === imageType?.toLowerCase(),
		)
		if (match.length && imageUrl === '') {
			imageUrl = `${dir}/${data.ratio}/${preferredImageType.toLowerCase()}${data.size}.${data.extension}`
		}
	}

	if (imageUrl === '') {
		const [, imageType] = supportedImagesWithRatio[0] ?? []
		if (imageType) {
			imageUrl = `${dir}/${data.ratio}/${imageType.toLowerCase()}${data.size}.${data.extension}`
		}
	}

	return imageUrl
}

/**
 * Live-channel logos ("On Now" feeds) only exist as 4x3 PNGs under a `station/` path —
 * no 16x9/2x3/1x1 artwork is generated for them, so the normal layout prefs never match.
 */
function resolveChannelLogoUrl(imageBaseUrl: string, item: Item): string {
	return getImageUrl({
		baseImageServiceUrl: imageBaseUrl,
		item: {
			Id: item.Id,
			ImageBucketId: item.ImageBucketId || DEFAULT_IMAGE_BUCKET,
			SupportedImages: item.SupportedImages,
		},
		itemType: 'station',
		ratio: '4x3',
		size: 'large',
		imageTypePreference: ['icon', 'logo'],
		extension: 'png',
	})
}

/**
 * Tried when the layout's own ratio is missing, nearest shape first — object-cover crops the
 * mismatch, and a portrait poster in a 16x9 card is the worst of them.
 */
const RATIO_FALLBACKS: Record<string, string[]> = {
	'16x9': ['1x1', '4x3', '3x4', '2x3'],
	'2x3': ['1x1', '3x4', '4x3', '16x9'],
	'1x1': ['4x3', '16x9', '3x4', '2x3'],
	'4x3': ['16x9', '1x1', '3x4', '2x3'],
	'3x4': ['2x3', '1x1', '4x3', '16x9'],
}

/** 1x1 artwork is only generated at xxlarge, and xxxlarge exists only at 16x9. */
const SQUARE_ONLY_SIZE = 'xxlarge'
const FALLBACK_SIZE = 'xlarge'

/** Size a fallback ratio is actually generated at — the layout's own size may not exist there. */
function fallbackSize(ratio: string): 'xlarge' | 'xxlarge' {
	return ratio === '1x1' ? SQUARE_ONLY_SIZE : FALLBACK_SIZE
}

type LayoutPref = { ratio: string; types: string[]; size: 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge' }

/** Layouts a rail can ask for — `4x3`/`3x4` exist because MK feeds can declare those shapes. */
export type ImageLayout = 'hero' | 'backdrop' | 'poster' | 'character' | 'player' | '4x3' | '3x4'

const LAYOUT_PREFS: Record<ImageLayout, LayoutPref> = {
	hero: { ratio: '16x9', types: ['carousel1', 'keyart', 'poster'], size: 'xxxlarge' },
	backdrop: { ratio: '16x9', types: ['poster', 'keyart'], size: 'xlarge' },
	poster: { ratio: '2x3', types: ['poster', 'keyart'], size: 'xlarge' },
	character: { ratio: '1x1', types: ['poster', 'keyart', 'players', 'thumbnail'], size: SQUARE_ONLY_SIZE },
	player: { ratio: '1x1', types: ['keyart'], size: SQUARE_ONLY_SIZE },
	// MK only generates keyart at these ratios, up to xxlarge — no `poster`, no xxxlarge.
	'4x3': { ratio: '4x3', types: ['keyart', 'poster'], size: FALLBACK_SIZE },
	'3x4': { ratio: '3x4', types: ['keyart', 'poster'], size: FALLBACK_SIZE },
}

/**
 * Resolves a catalog item to its best image URL for the given layout.
 * Live channels bypass the layout prefs entirely (see `resolveChannelLogoUrl`).
 * Picks from `SupportedImages` by ratio + type preference. When the layout's ratio is
 * unavailable, walks `RATIO_FALLBACKS` so an item that only carries another ratio still
 * renders instead of blanking the card. Returns an empty string when no real image is
 * available — callers in API mode must not substitute a mock placeholder; the UI renders
 * a neutral fallback instead.
 */
export function resolveImageUrl(imageBaseUrl: string, item: Item, layout: ImageLayout): string {
	if (item.ItemType === 'Channel') return resolveChannelLogoUrl(imageBaseUrl, item)

	const p = LAYOUT_PREFS[layout]
	const itemType: 'series' | 'program' | 'person' =
		layout === 'player' ? 'person' : item.ItemType === 'Program' || item.ItemType === 'Event' ? 'program' : 'series'
	const imageArgs = {
		baseImageServiceUrl: imageBaseUrl,
		item: { Id: item.Id, ImageBucketId: item.ImageBucketId, SupportedImages: item.SupportedImages },
		itemType,
		size: p.size,
		extension: 'jpg' as const,
	}

	const url = getImageUrl({ ...imageArgs, ratio: p.ratio, imageTypePreference: p.types })
	if (url) return url

	for (const ratio of RATIO_FALLBACKS[p.ratio] ?? []) {
		const fallback = getImageUrl({
			...imageArgs,
			ratio,
			size: fallbackSize(ratio),
			imageTypePreference: [...p.types, 'keyart', 'poster', 'thumbnail'],
		})
		if (fallback) return fallback
	}

	return ''
}

/** Directory holding a catalog item's artwork, taken from one of its own image URIs. */
function imageDirFromUri(uri?: string): string {
	const trimmed = uri?.trim() ?? ''
	const cut = trimmed.lastIndexOf('/')
	return cut > 0 ? trimmed.slice(0, cut) : ''
}

export type ContinueWatchingArtwork = {
	/** `CatalogInfo.Images` — thumbnails, used only to locate the artwork directory. */
	images?: { Uri: string }[]
	supportedImages?: string[]
	/** `CatalogInfo.UniversalProgramId`, for items MK returns without any `Images`. */
	universalProgramId?: string
	imageBucketId?: string
	imageBaseUrl?: string
}

/**
 * Continue Watching artwork. Every URI in `Images` is a ~180px portrait thumbnail whatever its
 * `...Landscape` name claims, so the card-sized artwork is addressed by ratio and size instead.
 *
 * Two ways to find the directory it sits in, because MK omits `Images` on some library items
 * (three of 22 on the demo account, e.g. `tenant1_fake_ts-1171p_engage_movie`): take it from a
 * thumbnail URI, or build it from the item's own id per MK's construction rules. The `title`
 * segment is the one MK itself uses in the URIs it does return for these items.
 *
 * Returns an empty string when the item declares no ratio the card can use.
 */
export function resolveContinueWatchingImage(artwork: ContinueWatchingArtwork): string {
	const { images, supportedImages, universalProgramId, imageBucketId, imageBaseUrl } = artwork
	const baseDir = imageDirFromUri(images?.[0]?.Uri)
	if (!baseDir && !(universalProgramId && imageBaseUrl)) return ''

	// Same card and same type preference as any other backdrop rail — only the directory differs.
	const p = LAYOUT_PREFS.backdrop
	const args = {
		baseImageServiceUrl: imageBaseUrl ?? '',
		item: {
			Id: baseDir ? '' : (universalProgramId ?? ''),
			ImageBucketId: imageBucketId ?? DEFAULT_IMAGE_BUCKET,
			SupportedImages: supportedImages,
		},
		itemType: 'title' as const,
		extension: 'jpg' as const,
		imageTypePreference: [...p.types, 'keyart', 'carousel1', 'thumbnail'],
		...(baseDir ? { baseDir } : {}),
	}

	for (const ratio of [p.ratio, ...(RATIO_FALLBACKS[p.ratio] ?? [])]) {
		const url = getImageUrl({ ...args, ratio, size: fallbackSize(ratio) })
		if (url) return url
	}
	return ''
}
