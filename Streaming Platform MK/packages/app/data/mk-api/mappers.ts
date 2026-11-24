import type { CardAspect, HeroData, HeroItemData, RailData, RailItemData, RailVariant } from '@pkg/design-system'
import { formatDuration } from '@pkg/utils'
import type { ImageLayout } from './image'
import type { ProgrammeWindow } from './live-progress'
import type {
	DiscoveryFeedItemsResponse,
	EventPlayOptionsResponse,
	Item,
	PlayableChannel,
	Player,
	ProgramTitle,
	SubscriberContinueWatchingResponse,
	TitleDetail,
} from './types'

// ── Hero ────────────────────────────────────────────────────────

/** Per-item enrichment data merged into HeroItemData (synopsis, duration, etc.). */
export type HeroEnrichment = Record<
	string,
	Partial<Pick<HeroItemData, 'imageUrl' | 'logoUrl' | 'tagLabel' | 'year' | 'duration' | 'synopsis'>>
>

/** Resolves an MK API `Item` to a hero-layout image URL string. */
export type HeroImageResolver = (item: Item) => string

/** Maps raw feed items to the design-system `HeroData` contract. */
export function mapFeedItemsToHero(
	response: DiscoveryFeedItemsResponse,
	resolveImage: HeroImageResolver,
	enrichment: HeroEnrichment = {},
): HeroData {
	const items: HeroItemData[] = response.Items.map((item) => ({
		id: item.Id,
		title: item.Name,
		imageUrl: resolveImage(item),
		href: `/title?id=${encodeURIComponent(item.Id)}`,
		...(enrichment[item.Id] ?? {}),
	}))

	return { items }
}

// ── Standard rails ──────────────────────────────────────────────

export type FeedRailVariant = Exclude<RailVariant, 'continue'>

/** Resolves an MK API `Item` to a card-layout image URL string. */
export type FeedImageResolver = (item: Item, layout: ImageLayout) => string

/** The rail's declared shape decides the artwork ratio; otherwise the variant's own does. */
function imageLayoutForVariant(variant: FeedRailVariant, aspect?: CardAspect | null): ImageLayout {
	if (aspect === '4x3' || aspect === '3x4') return aspect
	if (aspect === 'poster') return 'poster'
	if (aspect === 'square') return 'character'
	if (aspect === 'video') return 'backdrop'
	if (variant === 'poster') return 'poster'
	if (variant === 'character') return 'character'
	return 'backdrop'
}

/** Maps raw feed items to the design-system `RailData` contract. */
export function mapFeedItemsToRail(
	feedId: string,
	title: string,
	response: DiscoveryFeedItemsResponse,
	variant: FeedRailVariant,
	resolveImage: FeedImageResolver,
	aspect?: CardAspect | null,
): RailData {
	const imageLayout = imageLayoutForVariant(variant, aspect)
	const items: RailItemData[] = response.Items.map((item) => {
		const base = {
			id: item.Id,
			title: item.Name,
			imageUrl: resolveImage(item, imageLayout),
			href: `/title?id=${encodeURIComponent(item.Id)}`,
			showType: item.ShowType as RailItemData['showType'],
			isAdult: item.IsAdult === true ? true : undefined,
			rating: item.Ratings?.[0]?.Value,
		}

		switch (variant) {
			case 'live':
				return {
					...base,
					variant: 'live',
					// No programme timing on this path — the card hides its bar rather than drawing
					// an empty one (#72). Channel rails get it from AMP, see `fetchLiveProgress`.
					live: { channel: item.Name, show: item.Name },
				}
			case 'schedule':
				return { ...base, variant: 'schedule' }
			case 'highlights':
				return { ...base, variant: 'highlights' }
			case 'multiview':
				return { ...base, variant: 'multiview' }
			case 'sponsored':
				return { ...base, variant: 'sponsored' }
			case 'character':
				return { ...base, variant: 'character' }
			case 'poster':
				return { ...base, variant: 'poster' }
			case 'backdrop':
				return { ...base, variant: 'backdrop' }
			default: {
				const _exhaustive: never = variant
				return _exhaustive
			}
		}
	})

	return { id: feedId, title, variant, items, ...(aspect ? { aspect } : {}) }
}

export type PlayerImageResolver = (player: Player) => string

export type MapPlayersToRailInput = {
	feedId: string
	title: string
	players: Player[]
	resolveImage: PlayerImageResolver
}

/** Maps player/person API results to a 1x1 character rail. */
export function mapPlayersToRail({ feedId, title, players, resolveImage }: MapPlayersToRailInput): RailData {
	const items: RailItemData[] = players.map((player) => ({
		id: player.Id,
		title: player.Name,
		subtitle: player.SportsType,
		imageUrl: resolveImage(player),
		href: '#',
		variant: 'character',
		showType: 'Series',
	}))

	return { id: feedId, title, variant: 'character', items }
}

/**
 * TODO: HARD-CODED. Mosaic card names, by feed count. The channel map names every mosaic after the
 * station it was cloned from, so left alone the cards read "KTVU-2 (FOX)" and repeat one another;
 * MK cannot rename them at the API level, so the demo names them here. Marketing may revisit these.
 */
const MULTIVIEW_CARD_TITLES: Record<number, string> = {
	2: 'Duo',
	3: 'Prime',
	4: 'Ultra',
}

/** Used when the stream's name gives away no feed count — the badge is hidden in that case too. */
const MULTIVIEW_CARD_TITLE_FALLBACK = 'Multiview'

function multiviewCardTitle(channel: PlayableChannel): string {
	return (
		(channel.multiviewFeedCount && MULTIVIEW_CARD_TITLES[channel.multiviewFeedCount]) || MULTIVIEW_CARD_TITLE_FALLBACK
	)
}

export const LIVE_CHANNEL_TITLE_ID_PREFIX = 'live-channel:'

export function liveChannelTitleHref(channelId: string) {
	return `/title?id=${encodeURIComponent(`${LIVE_CHANNEL_TITLE_ID_PREFIX}${channelId}`)}`
}

/**
 * Route a multiview channel to the dedicated mosaic player instead of the single-stream player.
 * Query param, not a path segment: the prod deploy is a static export, so a path route only exists
 * for the ids `generateStaticParams` listed and any new mosaic would fall back to the home page.
 */
export function multiviewChannelHref(channelId: string) {
	return `/multiview?id=${encodeURIComponent(channelId)}`
}

function mapChannelToLiveItem(channel: PlayableChannel, schedule?: ProgrammeWindow[]): RailItemData {
	return {
		id: channel.id,
		title: channel.title,
		imageUrl: channel.imageUrl,
		href: liveChannelTitleHref(channel.id),
		variant: 'live',
		showType: 'Channel',
		live: {
			channel: channel.channelLabel,
			show: channel.showLabel,
			schedule,
		},
	}
}

function mapChannelToMultiviewItem(channel: PlayableChannel): RailItemData {
	return {
		id: channel.id,
		title: multiviewCardTitle(channel),
		imageUrl: channel.imageUrl,
		href: multiviewChannelHref(channel.id),
		variant: 'multiview',
		showType: 'Channel',
		// The backend exposes no feed count, so this comes from the stream's name; the badge
		// hides itself when nothing names it (2-up/3-up/4-up all have their own icon).
		multiviewCount: channel.multiviewFeedCount,
		// metaLine omitted — the backend provides no per-feed metadata to show.
	}
}

/**
 * Maps resolved playable live channels to a design-system rail.
 *
 * A rail of all-multiview channels renders as the mosaic-card variant (16:9 art + feed-count
 * badge); anything else stays a live rail. Adil keeps MV and "on now" channels on separate
 * rails, so in practice a rail is uniformly one or the other.
 */
export function mapPlayableChannelsToRail(
	feedId: string,
	title: string,
	channels: PlayableChannel[],
	/** Programme windows per channel, positionally matched to `channels`. */
	schedules: ProgrammeWindow[][] = [],
): RailData {
	const allMultiview = channels.length > 0 && channels.every((channel) => channel.isMultiview)

	if (allMultiview) {
		return { id: feedId, title, variant: 'multiview', items: channels.map(mapChannelToMultiviewItem) }
	}

	// Multiview channels mixed into a live rail keep their mosaic href but render as live cards.
	const items = channels.map((channel, i) =>
		channel.isMultiview
			? {
					...mapChannelToLiveItem(channel, schedules[i]),
					title: multiviewCardTitle(channel),
					href: multiviewChannelHref(channel.id),
				}
			: mapChannelToLiveItem(channel, schedules[i]),
	)

	return { id: feedId, title, variant: 'live', items }
}

// ── Continue Watching ───────────────────────────────────────────

export type CWImageResolver = (item: SubscriberContinueWatchingResponse['LibraryItems'][number]) => string

export function mapContinueWatchingToRail(
	response: SubscriberContinueWatchingResponse,
	resolveImage: CWImageResolver,
): RailData {
	const items: RailItemData[] = response.LibraryItems.filter((item) => item.Bookmark != null).map((item) => {
		const bookmark = item.Bookmark
		if (!bookmark) throw new Error(`Unreachable: filtered above for item ${item.Id}`)
		const progress = bookmark.RuntimeSeconds > 0 ? Math.min(bookmark.TimeSeconds / bookmark.RuntimeSeconds, 1) : 0

		// `item.Id` is the asset/Vods[0].Id — needed for bookmark PUT URL.
		// `Bookmark.ProgramId` is what `/title?id=...` and play-options expect.
		const programId = bookmark.ProgramId || item.Id
		return {
			id: programId,
			title: item.CatalogInfo.Name,
			imageUrl: resolveImage(item),
			href: `/title?id=${encodeURIComponent(programId)}`,
			variant: 'continue' as const,
			progress,
			showType: item.CatalogInfo.ShowType as RailItemData['showType'],
			isAdult: item.CatalogInfo.IsAdult === true ? true : undefined,
			rating: item.CatalogInfo.Ratings?.[0]?.Value,
			episodeLabel: formatEpisodeLabel(
				item.CatalogInfo.SeasonNumber,
				item.CatalogInfo.EpisodeNumber,
				item.CatalogInfo.EpisodeName,
			),
			duration: formatDuration(item.CatalogInfo.RuntimeSeconds),
			isLastChance: item.IsLastChance === true ? true : undefined,
			isFree: item.IsContentFree === true ? true : undefined,
			expiresAt: item.PlayActions?.[0]?.ExpirationUtc,
		}
	})

	return { id: 'continue-watching', title: 'Continue Watching', variant: 'continue', items }
}

function formatEpisodeLabel(season?: number, episode?: number | string, name?: string): string | undefined {
	if (!season && !episode) return undefined
	const se = [season && `S${season}`, episode && `E${episode}`].filter(Boolean).join(' ')
	return name ? `${se} · ${name}` : se
}

// ── Title Detail ───────────────────────────────────────────────

/** Picks the best landscape image URL from the program's catalog images. */
export function pickBestImage(images: ProgramTitle['CatalogInfo']['Images']): string | undefined {
	if (!images || images.length === 0) return undefined

	const isLandscape = (type: string) => /landscape/i.test(type)

	// Prefer landscape images in descending priority
	const ranked = [
		images.find((i) => i.ImageType === 'KeyArtLandscape' && i.Size === 'Large'),
		images.find((i) => i.ImageType === 'KeyArtLandscape' && i.Size === 'Medium'),
		images.find((i) => i.ImageType === 'PosterLandscape' && i.Size === 'Large'),
		images.find((i) => i.ImageType === 'PosterLandscape' && i.Size === 'Medium'),
		// Any landscape type
		images.find((i) => isLandscape(i.ImageType) && i.Size === 'Large'),
		images.find((i) => isLandscape(i.ImageType)),
		// Last resort — any Large, then any image
		images.find((i) => i.Size === 'Large'),
		images[0],
	]

	const best = ranked.find(Boolean)
	return best?.Uri
}

/** Maps a ProgramTitle (from play-options) to the normalized TitleDetail the UI consumes. */
export function mapPlayOptionsToTitleDetail(
	programId: string,
	title: ProgramTitle,
	assetType: TitleDetail['assetType'] = 'vod' as TitleDetail['assetType'],
): TitleDetail {
	const info = title.CatalogInfo
	const bestAction = title.PlayActions[0]

	return {
		id: programId,
		name: info.Name,
		showType: info.ShowType,
		assetType,
		year: info.ReleaseYear,
		runtime: info.RuntimeSeconds > 0 ? formatDuration(info.RuntimeSeconds) : undefined,
		runtimeSeconds: info.RuntimeSeconds > 0 ? info.RuntimeSeconds : undefined,
		synopsis: info.Description,
		rating: info.Ratings?.[0]?.Value,
		isAdult: info.IsAdult,
		imageUrl: pickBestImage(info.Images),
		images: info.Images ?? [],
		playbackUrl: bestAction?.VideoProfile.PlaybackUri,
		playbackExpires: bestAction?.ExpirationUtc,
		playActions: title.PlayActions,
		isGeoBlocked: title.IsGeoBlocked,
		isContentFree: title.IsContentFree,
		assetId: title.Id,
		mediaId: bestAction?.VideoProfile.Id,
		offerId: bestAction?.OfferId,
		ownerUid: bestAction?.VideoProfile.Owner,
	}
}

/**
 * Maps a live event play-options response (`/v2/events/{id}/play-options`) to a
 * TitleDetail. Events play via registered SDK mode using the production's
 * Service (MediaId/OwnerId) + PlayAction OfferId — there is no direct PlaybackUri.
 * Returns null when no playable production/service is present.
 */
export function mapEventPlayOptionsToTitleDetail(
	eventId: string,
	response: EventPlayOptionsResponse,
): TitleDetail | null {
	const schedule = response.Schedules[0]
	if (!schedule) return null

	const production = schedule.Productions.find((p) => p.Role === 'home') ?? schedule.Productions[0]
	if (!production) return null

	const service = production.Services.find((s) => s.IsValid && s.MediaId) ?? production.Services[0]
	if (!service?.MediaId) return null

	const action = production.PlayActions[0]
	const name = production.DisplayName?.[0]?.Value ?? schedule.Name

	return {
		id: eventId,
		name,
		showType: 'Event',
		assetType: 'event' as TitleDetail['assetType'],
		isAdult: false,
		images: [],
		playActions: [],
		playbackExpires: action?.ExpirationUtc,
		isGeoBlocked: production.IsContentRestrictedForGeolocation,
		mediaId: service.MediaId,
		ownerUid: service.OwnerId,
		// Events play like live channels: applicationToken = the production (service-collection)
		// id, and NO offerId — passing the offer id triggers a "Free teaser offer" rejection.
		applicationToken: production.Id,
		startUtc: schedule.StartUtc,
		endUtc: schedule.EndUtc,
	}
}

// ── View All ────────────────────────────────────────────────────

const DISCOVERY_FEED_URI = /^udl:\/\/discovery\/feeds\/.+$/i

/**
 * Builds the "View all" target for a feed's rail, or null when the feed is not configured for it.
 *
 * TODO: NavigationTargetUri (e.g. "browsemovies") is intentionally NOT used as the route key —
 * many feeds share the same value, so it collides. Routing by feed id keeps each rail's grid
 * distinct. A future dedicated browse endpoint could resolve NavigationTargetUri instead.
 */
export function buildFeedViewAll(feed: {
	id: string
	uri: string
	navigationTargetUri?: string
	navigationTargetText?: string
	navigationTargetVisibility?: string
}): { href: string; label: string } | null {
	const visibility = feed.navigationTargetVisibility?.trim().toLowerCase().replace(/\s+/g, '') ?? ''
	if (visibility !== 'always') return null
	if (!feed.navigationTargetUri) return null
	if (!DISCOVERY_FEED_URI.test(feed.uri?.trim() ?? '')) return null

	// Label is always "View all" — NavigationTargetText is intentionally ignored (per design decision).
	// Query-param route (not a path segment) so it resolves under static export (output: 'export').
	return {
		href: `/browse?feed=${encodeURIComponent(feed.id)}`,
		label: 'View all',
	}
}
