import type { HeroData, RailData, RailVariant } from '@pkg/design-system'
import { formatDuration, formatEventStartLabel } from '@pkg/utils'
import { resolveHomeHubId } from '../home-hub'
import { deviceProfileHeader } from './device-profile'
import type { ImageLayout } from './image'
import { resolveContinueWatchingImage, resolveImageUrl } from './image'
import { type AmpQueryResponse, type ProgrammeWindow, scheduleFromAmpQuery } from './live-progress'
import {
	buildFeedViewAll,
	type CWImageResolver,
	type HeroEnrichment,
	LIVE_CHANNEL_TITLE_ID_PREFIX,
	mapContinueWatchingToRail,
	mapEventPlayOptionsToTitleDetail,
	mapFeedItemsToHero,
	mapFeedItemsToRail,
	mapPlayableChannelsToRail,
	mapPlayOptionsToTitleDetail,
	pickBestImage,
} from './mappers'
import { isMultiviewMediaId, multiviewFeedCount, multiviewGroupKey, multiviewSpotlightKey } from './multiview'
import { mapPersonsToRail, type Person, personsResponseSchema } from './players'
import { showcardAspectVariant, showcardCardAspect } from './showcard-aspect'
import type {
	AppConfig,
	BrowseRailPage,
	ChannelMapChannel,
	ChannelMapResponse,
	ChannelMapService,
	ChannelMapServiceCollection,
	DiscoveryFeedItemsResponse,
	DiscoveryHubsResponse,
	EventPlayOptionsResponse,
	FeedDescriptor,
	IpStatusResponse,
	Item,
	LiveRight,
	LiveRightsResponse,
	MultiviewSpotlight,
	PageFeedManifest,
	PlayableChannel,
	ProgramPlayOptionsResponse,
	SubscriberContinueWatchingResponse,
	SubscriberSeriesV2Response,
	TitleDetail,
} from './types'

type HubFeed = DiscoveryHubsResponse[number]['Feeds'][number]
type ApiFeedRailVariant = Exclude<RailVariant, 'continue'>

/** Feed-items page size for single-shot fetches (home rails, hero). Keep above `RAIL_MAX_CARDS` — the surplus signals overflow. */
const FEED_ITEMS_PAGE_SIZE = 25
/** View All grid page size for backend `$skip`/`$top` paging. */
const BROWSE_PAGE_SIZE = 25
/** How long the resolved channel map stays reusable within one provider instance. */
const PLAYABLE_CHANNELS_TTL_MS = 60_000

function authHeader(accessToken: string) {
	return `OAUTH2 access_token="${accessToken}"`
}
const VOD_ASSET_TYPE = 'vod' as TitleDetail['assetType']
const EVENT_ASSET_TYPE = 'event' as TitleDetail['assetType']

function normalizeMetadataValue(value?: string | null) {
	return value?.trim().toLowerCase().replace(/\s+/g, '') ?? ''
}

function isContinueWatchingUri(uri?: string | null) {
	return normalizeMetadataValue(uri) === 'udl://subscriber/library/continue'
}

function isSubscriberLibraryUri(uri?: string | null) {
	return normalizeMetadataValue(uri).startsWith('udl://subscriber/library/')
}

function isLiveChannelsUri(uri?: string | null) {
	const normalized = normalizeMetadataValue(uri)
	return (
		normalized === 'udl://live/feeds/playablechannels' || normalized.startsWith('udl://live/feeds/playablechannels/')
	)
}

function liveChannelIdFromTitleId(titleId: string) {
	return titleId.startsWith(LIVE_CHANNEL_TITLE_ID_PREFIX) ? titleId.slice(LIVE_CHANNEL_TITLE_ID_PREFIX.length) : null
}

function isPlayersUri(uri?: string | null) {
	return normalizeMetadataValue(uri) === 'udl://feeds/players'
}

function trimTrailingSlash(value: string) {
	return value.replace(/\/$/, '')
}

/**
 * Some stores carry filter params in the feed UDL, e.g. `movies/?Genre=2715`.
 * Splicing that straight into the path yields `feeds/movies/?Genre=2715/items?…`,
 * which 404s. Verified against MK: the path part is the feed id and the query part
 * merges into the request params (`feeds/movies/items?Genre=2715&…`).
 */
export function splitFeedSegment(segment: string): { feedId: string; extraParams: URLSearchParams } {
	const queryStart = segment.indexOf('?')
	if (queryStart < 0) return { feedId: trimTrailingSlash(segment), extraParams: new URLSearchParams() }

	return {
		feedId: trimTrailingSlash(segment.slice(0, queryStart)),
		extraParams: new URLSearchParams(segment.slice(queryStart + 1)),
	}
}

/** Returns the feed id for `/discovery/v4/feeds/{id}/items` — the URI segment (Dynamic feeds use a keyword like `events`, not the GUID). */
function discoveryFeedIdFromUri(uri?: string | null): string | null {
	const match = /^udl:\/\/discovery\/feeds\/(.+)$/i.exec(uri?.trim() ?? '')
	if (!match) return null
	const segment = trimTrailingSlash(match[1]).trim()
	return segment.length > 0 ? segment : null
}

function matchesStoreId(localizedStoreId: string, storeId: string) {
	const normalizedLocalizedStore = normalizeMetadataValue(localizedStoreId)
	const normalizedStore = normalizeMetadataValue(storeId)

	return normalizedLocalizedStore === normalizedStore || normalizedLocalizedStore.startsWith(`${normalizedStore}-`)
}

function buildChannelMapUrl(catalogCacheUrl: string, channelMapId: number) {
	const baseUrl = trimTrailingSlash(catalogCacheUrl)
	const channelMapPath = /\/s\d+-cache-channel-maps$/i.test(baseUrl)
		? `${baseUrl}/${channelMapId}`
		: `${baseUrl}/s300-cache-channel-maps/${channelMapId}`

	return `${channelMapPath}?_t=${Date.now()}`
}

function isHeroCarouselFeed(feed: HubFeed) {
	return normalizeMetadataValue(feed.ShowcardAspectRatio) === 'carousel'
}

export function toFeedDescriptor(feed: HubFeed): FeedDescriptor {
	return {
		id: feed.Id,
		name: feed.Name,
		uri: feed.Uri,
		feedType: feed.FeedType,
		layout: feed.Layout,
		showcardAspectRatio: feed.ShowcardAspectRatio,
		defaultSortType: feed.DefaultSortType,
		navigationTargetUri: feed.NavigationTargetUri,
		navigationTargetText: feed.NavigationTargetText,
		navigationTargetVisibility: feed.NavigationTargetVisibility,
	}
}

function mapFeedToVariant(feed: FeedDescriptor): ApiFeedRailVariant | null {
	if (isLiveChannelsUri(feed.uri)) return 'live'
	return showcardAspectVariant(feed.showcardAspectRatio)
}

/** `SupportedImages` is omitted entirely on items with no artwork (e.g. live channels). */
function imageRatios(item: Item): string[] {
	return (item.SupportedImages ?? []).map((img) => normalizeMetadataValue(img).split('/')[0])
}

/** True when every item that has artwork exposes `ratio`; items with none are ignored. */
function everyArtworkedItemHas(response: DiscoveryFeedItemsResponse, ratio: string): boolean {
	let found = false
	for (const item of response.Items) {
		const ratios = imageRatios(item)
		if (ratios.length === 0) continue
		if (!ratios.includes(ratio)) return false
		found = true
	}
	return found
}

/** True when every item with artwork has a 1x1 (square rail, e.g. "Club Logos"). */
export function feedRendersAsSquare(response: DiscoveryFeedItemsResponse): boolean {
	return everyArtworkedItemHas(response, '1x1')
}

/** Last resort when the feed declares no `ShowcardAspectRatio` — read the ratio the items agree on. */
export function fallbackVariantFromImages(response: DiscoveryFeedItemsResponse): ApiFeedRailVariant {
	if (everyArtworkedItemHas(response, '1x1')) return 'character'
	// Every item must have 2x3: one poster item must not force 16x9-only items into a portrait rail.
	return everyArtworkedItemHas(response, '2x3') ? 'poster' : 'backdrop'
}

/** Keyword patterns used to match a hub by name when no hub ID is configured. */
export const HUB_KEYWORDS = {
	home: ['on demand', 'home', 'movie'],
	sports: ['sport'],
	kids: ['kid', 'child', 'famil'],
} as const satisfies Record<string, readonly string[]>

/** Creates an MK API provider scoped to a tenant + access token pair. */
export function createMkApiProvider(
	config: AppConfig,
	accessToken: string,
	userAccessToken?: string | null,
	userProfileId?: string | null,
) {
	const auth = authHeader(accessToken)
	const subUrl = trimTrailingSlash(config.subscriberServiceUrl)
	const catalogCacheUrl = trimTrailingSlash(config.catalogCacheUrl)

	// ── Image resolvers ─────────────────────────────────────────

	const feedImage = (item: Item, layout: ImageLayout) => resolveImageUrl(config.imageBaseUrl, item, layout)

	const heroImage = (item: Item) => resolveImageUrl(config.imageBaseUrl, item, 'hero')

	const personAsItem = (p: Person): Item => ({
		Id: p.Id,
		Name: p.Name,
		ItemType: 'Program',
		ShowType: '',
		SupportedImages: p.SupportedImages,
		ImageBucketId: p.ImageBucketId,
		IsAdult: false,
		IsGeneric: false,
	})

	const playerImage = (p: Person) => resolveImageUrl(config.imageBaseUrl, personAsItem(p), 'player')

	const cwImage: CWImageResolver = (cwItem) => {
		const info = cwItem.CatalogInfo
		if (!info) return ''
		// Card-sized artwork first; the `Images` thumbnails are the last resort, not the default.
		const artwork = resolveContinueWatchingImage({
			images: info.Images,
			supportedImages: info.SupportedImages,
			universalProgramId: info.UniversalProgramId,
			imageBucketId: info.ImageBucketId,
			imageBaseUrl: config.imageBaseUrl,
		})
		return artwork || pickBestImage(info.Images) || ''
	}

	// ── Fetch helpers ───────────────────────────────────────────

	async function fetchHubs(): Promise<DiscoveryHubsResponse> {
		const params = new URLSearchParams({
			$lang: 'en-US',
			TenantId: config.tenantId,
			$groups: config.groups,
			deviceType: 'AndroidStb',
			storeId: config.storeId,
		})

		const res = await fetch(`${config.discoveryUrl}/v3/hubs?${params}`, {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetHubs failed: ${res.status}`)
		return (await res.json()) as DiscoveryHubsResponse
	}

	async function fetchFeedItems(
		feedId: string,
		opts?: { top?: number; skip?: number },
	): Promise<DiscoveryFeedItemsResponse> {
		const params = new URLSearchParams({
			$lang: 'en-US',
			$groups: config.groups,
			deviceType: 'AndroidStb',
			storeId: config.storeId,
			$top: String(opts?.top ?? FEED_ITEMS_PAGE_SIZE),
			$skip: String(opts?.skip ?? 0),
			// locationDetail intentionally omitted: geo filtering hides demo live events
			// that have no region availability configured, so we skip it for the sales demo.
			// locationDetail: config.locationDetail,
		})

		const { feedId: feedPath, extraParams } = splitFeedSegment(feedId)
		for (const [key, value] of extraParams) params.set(key, value)

		const res = await fetch(`${config.discoveryUrl}/v4/feeds/${feedPath}/items?${params}`, {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetFeedItems(${feedId}) failed: ${res.status}`)
		return (await res.json()) as DiscoveryFeedItemsResponse
	}

	async function fetchChannelMap(): Promise<ChannelMapResponse> {
		if (!config.channelMapId) throw new Error('Playable channels failed: no ChannelMapId in bootstrap')
		const res = await fetch(buildChannelMapUrl(catalogCacheUrl, config.channelMapId), {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetChannelMap(${config.channelMapId}) failed: ${res.status}`)
		return (await res.json()) as ChannelMapResponse
	}

	async function fetchLiveRights(): Promise<LiveRightsResponse> {
		const res = await fetch(`${subUrl}/rights/live/channel-map`, {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetLiveRights failed: ${res.status}`)
		return (await res.json()) as LiveRightsResponse
	}

	async function fetchIpStatus(): Promise<IpStatusResponse> {
		const params = new URLSearchParams({ storeId: config.storeId })
		const res = await fetch(`${subUrl}/v4/ip-status/out-of-country-out-of-home?${params}`, {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetIpStatus failed: ${res.status}`)
		return (await res.json()) as IpStatusResponse
	}

	function pickChannelImage(channel: ChannelMapChannel): string | null {
		const images = channel.Images ?? []
		const ranked = [
			images.find((image) => image.ImageType === 'Icon' && image.Size === 'Large'),
			images.find((image) => image.ImageType === 'Icon' && image.Size === 'Medium'),
			images.find((image) => image.ImageType === 'Logo' && image.Size === 'Large'),
			images.find((image) => image.ImageType === 'Logo'),
			images.find((image) => image.Uri || image.Url),
		]
		const image = ranked.find(Boolean)
		const uri = image?.Uri ?? image?.Url
		if (!uri) return null
		if (/^https?:\/\//i.test(uri)) return uri
		return `${trimTrailingSlash(config.imageBaseUrl)}/${uri.replace(/^\//, '')}`
	}

	function isRightAllowed(right: LiveRight, ipStatus: IpStatusResponse) {
		if (normalizeMetadataValue(ipStatus.InCountry) === 'no') return false

		const restrictionValue = Array.isArray(right.r) ? right.r.join(' ') : (right.r ?? '')
		const restrictions = restrictionValue
			.split(/[,\s]+/)
			.map((restriction) => normalizeMetadataValue(restriction))
			.filter(Boolean)

		const isOutOfHome = normalizeMetadataValue(ipStatus.InHome) !== 'yes'
		if (isOutOfHome && restrictions.includes('oh')) return false

		return true
	}

	function findPlayableService(
		channel: ChannelMapChannel,
		rights: LiveRight[],
		serviceCollections: Map<number, ChannelMapServiceCollection>,
		services: Map<number, ChannelMapService>,
		ipStatus: IpStatusResponse,
	): ChannelMapService | null {
		if (!channel.ServiceCollectionId) return null
		if (!channel.IsApplication && rights.length === 0) return null

		const collection = serviceCollections.get(Number(channel.ServiceCollectionId))
		const serviceItems = collection?.ServiceItems ?? []
		const candidates = serviceItems
			.filter((item) => item.ServiceGrouping == null || item.ServiceGrouping === 0)
			.map((item) => services.get(Number(item.ServiceId)))
			.filter((service): service is ChannelMapService => {
				if (!service?.MediaId) return false
				const serviceIntent = normalizeMetadataValue(service.ServiceIntent)
				const serviceType = normalizeMetadataValue(service.Type)
				return serviceIntent === 'fullscreen' && ['hlsplayback', 'livesmoothstreaming'].includes(serviceType)
			})

		if (channel.IsApplication) return candidates[0] ?? null

		for (const right of rights) {
			if (!isRightAllowed(right, ipStatus)) continue
			const quality = normalizeMetadataValue(right.q)
			const service = candidates.find(
				(candidate) => !quality || normalizeMetadataValue(candidate.QualityLevel) === quality,
			)
			if (service) return service
		}

		return null
	}

	function mapPlayableChannels(
		channelMap: ChannelMapResponse,
		liveRights: LiveRightsResponse,
		ipStatus: IpStatusResponse,
	): PlayableChannel[] {
		const serviceCollections = new Map(
			(channelMap.ServiceCollections ?? []).map((collection) => [Number(collection.Id), collection]),
		)
		const services = new Map((channelMap.Services ?? []).map((service) => [Number(service.Id), service]))
		const rightsByChannelNumber = liveRights.channels ?? liveRights.Channels ?? {}

		return (channelMap.Channels ?? [])
			.slice()
			.sort((a, b) => Number(a.ChannelNumber) - Number(b.ChannelNumber))
			.flatMap((channel) => {
				if (channel.IsAdult) return []
				if (
					channel.LocalizedStoresIds?.length &&
					!channel.LocalizedStoresIds.some((storeId) => matchesStoreId(storeId, config.storeId))
				) {
					return []
				}

				const service = findPlayableService(
					channel,
					rightsByChannelNumber[String(channel.ChannelNumber)] ?? [],
					serviceCollections,
					services,
					ipStatus,
				)
				if (!service) return []

				const imageUrl = pickChannelImage(channel)

				const channelNumber = Number(channel.ChannelNumber)
				if (!Number.isFinite(channelNumber)) return []
				const title = channel.Name || channel.CallLetters || `Channel ${channel.ChannelNumber}`
				const channelLabel = channel.CallLetters || `${channel.ChannelNumber}`
				const id = String(channel.Id ?? service.MediaId ?? `channel-${channel.ChannelNumber}`)

				return [
					{
						id,
						title,
						channelLabel,
						showLabel: title,
						channelNumber,
						imageUrl: imageUrl ?? '',
						mediaId: service.MediaId,
						ownerId: service.OwnerId,
						serviceCollectionId: String(channel.ServiceCollectionId),
						stationId: channel.StationId != null ? String(channel.StationId) : undefined,
						isMultiview: isMultiviewMediaId(service.MediaId),
						multiviewFeedCount: multiviewFeedCount(service.MediaId, title, channel.CallLetters),
					},
				]
			})
	}

	/** How far back to ask AMP for slots — just enough to catch the one already running. */
	const LIVE_SCHEDULE_PAST_MS = 60 * 60 * 1000
	/**
	 * How far ahead. The card rolls through these on its own, so this is its runway; MK only
	 * holds a few hours of grid, and asking beyond that costs nothing and returns what exists.
	 */
	const LIVE_SCHEDULE_AHEAD_MS = 12 * 60 * 60 * 1000

	/** A channel can sit in more than one rail — fetch its schedule once, not once per rail. */
	const liveScheduleCache = new Map<string, { at: number; value: Promise<ProgrammeWindow[]> }>()

	/**
	 * Programme windows around now, empty when they cannot be known — the card then hides its
	 * bar instead of drawing an empty one (#72).
	 */
	async function fetchLiveSchedule(channel: PlayableChannel): Promise<ProgrammeWindow[]> {
		if (!config.playerServerUrl || !channel.mediaId) return []

		const now = Date.now()
		const cached = liveScheduleCache.get(channel.mediaId)
		if (cached && now - cached.at < PLAYABLE_CHANNELS_TTL_MS) return cached.value

		const value = requestLiveSchedule(channel.mediaId, channel.ownerId, now)
		liveScheduleCache.set(channel.mediaId, { at: now, value })
		return value
	}

	async function requestLiveSchedule(mediaId: string, ownerId: string | undefined, now: number) {
		const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z')
		const params = new URLSearchParams({
			channelId: mediaId,
			ownerUid: ownerId ?? config.tenantId,
			startDate: iso(now - LIVE_SCHEDULE_PAST_MS),
			endDate: iso(now + LIVE_SCHEDULE_AHEAD_MS),
			pbr: 'true',
			programs: 'true',
			partialPrograms: 'true',
			externalRecordings: 'false',
		})
		const url = `${trimTrailingSlash(config.playerServerUrl)}/v1/client/query?${params}`

		try {
			const res = await fetch(url, { headers: { deviceprofile: deviceProfileHeader() } })
			if (!res.ok) {
				console.warn(`[LIVE] AMP query failed for "${mediaId}": ${res.status}`)
				return []
			}
			const body = (await res.json()) as AmpQueryResponse
			// AMP answers 200 with result:"error" — a rejected device profile looks like success otherwise.
			if (body.result !== 'success') {
				console.warn(`[LIVE] AMP rejected the query for "${mediaId}": ${body.response?.message}`)
				return []
			}
			return scheduleFromAmpQuery(body)
		} catch (err) {
			console.warn(`[LIVE] AMP query threw for "${mediaId}"`, err)
			return []
		}
	}

	/**
	 * One card per mosaic. MK composites a 3-up once per spotlighted feed and ships each as its own
	 * channel, so the rail would otherwise show the same mosaic three times. The first variant in
	 * channel-number order wins, which is the base name — the others are reached by switching
	 * spotlight inside the player, not from the rail.
	 */
	function collapseMultiviewVariants(channels: PlayableChannel[]): PlayableChannel[] {
		const seen = new Set<string>()
		return channels.filter((channel) => {
			if (!channel.isMultiview) return true
			const key = multiviewGroupKey(channel.mediaId)
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	}

	async function fetchPlayableChannelsRail(feed: FeedDescriptor): Promise<RailData | null> {
		const channels = collapseMultiviewVariants(await fetchPlayableChannels())
		if (channels.length === 0) return null
		const schedules = await Promise.all(channels.map(fetchLiveSchedule))
		return mapPlayableChannelsToRail(feed.id, feed.name, channels, schedules)
	}

	// Shared by every live rail and channel detail on a page — fetch it once, not once per consumer.
	let playableChannelsCache: { at: number; value: Promise<PlayableChannel[]> } | null = null

	async function fetchPlayableChannels(): Promise<PlayableChannel[]> {
		const now = Date.now()
		if (playableChannelsCache && now - playableChannelsCache.at < PLAYABLE_CHANNELS_TTL_MS) {
			return playableChannelsCache.value
		}

		const value = (async () => {
			const [channelMap, liveRights, ipStatus] = await Promise.all([
				fetchChannelMap(),
				fetchLiveRights(),
				fetchIpStatus(),
			])
			return mapPlayableChannels(channelMap, liveRights, ipStatus)
		})()

		playableChannelsCache = { at: now, value }
		// Never cache a rejection — the next caller should retry.
		value.catch((err) => {
			console.warn('[MK API] Playable channels resolve failed, dropping cache so the next call retries', err)
			playableChannelsCache = null
		})

		return value
	}

	/** Custom "On Now" feeds only carry `StationId` — the playable `MediaId` comes from the channel map. */
	async function getChannelFeedRail(feed: FeedDescriptor, items: Item[]): Promise<RailData | null> {
		const channels = await fetchPlayableChannels()

		// A station can carry more than one channel: MK clones one station per mosaic, so on IBC
		// Sports `mv-test` (4-up) and `mv-test-3us` (3-up) both sit on station 14098. Keeping only
		// the last one would drop the 4-up from every curated rail, so hold all of them.
		const byStationId = new Map<string, PlayableChannel[]>()
		for (const channel of channels) {
			if (!channel.stationId) continue
			const clones = byStationId.get(channel.stationId) ?? []
			clones.push(channel)
			byStationId.set(channel.stationId, clones)
		}

		// Feed order wins — a custom rail is curated. A feed item names only a station, so the nth
		// mention of one takes the nth channel carrying it, in channel-number order; a station named
		// more often than the map carries it repeats its first channel rather than losing the card.
		const usedPerStation = new Map<string, number>()
		const matched = items.flatMap((item) => {
			const clones = byStationId.get(item.Id) ?? []
			const used = usedPerStation.get(item.Id) ?? 0
			const channel = clones[used] ?? clones[0]
			if (!channel) {
				console.warn(`[RAIL] getChannelFeedRail: no channel in the channel map for station ${item.Id}`)
				return []
			}
			usedPerStation.set(item.Id, used + 1)
			return [channel]
		})

		const deduped = collapseMultiviewVariants(matched)
		if (deduped.length === 0) return null
		const schedules = await Promise.all(deduped.map(fetchLiveSchedule))
		return mapPlayableChannelsToRail(feed.id, feed.name, deduped, schedules)
	}

	/**
	 * The mosaic's spotlight variants, in feed order, so the player can swap stream when the viewer
	 * picks a tile. Only one variant means MK ships no alternatives — the caller then leaves the
	 * spotlight fixed rather than offering a switch that does nothing.
	 */
	function spotlightsForChannel(channel: PlayableChannel, channels: PlayableChannel[]): MultiviewSpotlight[] {
		if (!channel.isMultiview) return []

		const group = multiviewGroupKey(channel.mediaId)
		const variants = channels
			.filter(
				(candidate) => candidate.isMultiview && !!candidate.mediaId && multiviewGroupKey(candidate.mediaId) === group,
			)
			.map((variant) => ({
				feedKey: multiviewSpotlightKey(variant.mediaId),
				mediaId: variant.mediaId as string,
				...(variant.serviceCollectionId ? { applicationToken: variant.serviceCollectionId } : {}),
				...(variant.ownerId ? { ownerUid: variant.ownerId } : {}),
			}))
			.sort((a, b) => a.feedKey.localeCompare(b.feedKey))

		return variants.length > 1 ? variants : []
	}

	function mapPlayableChannelToTitleDetail(
		channel: PlayableChannel,
		titleId: string,
		spotlights: MultiviewSpotlight[] = [],
	): TitleDetail | null {
		if (!channel.mediaId) return null

		return {
			...(spotlights.length > 0 ? { multiviewSpotlights: spotlights } : {}),
			id: titleId,
			name: channel.title,
			showType: 'Channel',
			assetType: EVENT_ASSET_TYPE,
			synopsis: channel.showLabel,
			isAdult: false,
			images: [],
			playActions: [],
			mediaId: channel.mediaId,
			applicationToken: channel.serviceCollectionId,
			authToken: accessToken,
			playerServerUrl: config.playerServerUrl,
			...(channel.imageUrl ? { imageUrl: channel.imageUrl } : {}),
			...(channel.ownerId ? { ownerUid: channel.ownerId } : {}),
		}
	}

	async function getPlayableChannelTitleDetail(titleId: string): Promise<TitleDetail | null> {
		const liveChannelId = liveChannelIdFromTitleId(titleId)
		if (!liveChannelId) return null

		const channels = await fetchPlayableChannels()
		const channel = channels.find((item) => item.id === liveChannelId || item.mediaId === liveChannelId)
		if (!channel) return null

		return mapPlayableChannelToTitleDetail(channel, titleId, spotlightsForChannel(channel, channels))
	}

	async function fetchSeriesDetail(seriesId: string): Promise<SubscriberSeriesV2Response | null> {
		const params = new URLSearchParams({
			vodOnly: 'true',
			locationDetail: config.locationDetail,
		})

		const res = await fetch(`${subUrl}/v4/series/${seriesId}?${params}`, {
			headers: { Authorization: auth, 'x-tv3-profiles': config.profileId },
		})

		if (!res.ok) return null
		return (await res.json()) as SubscriberSeriesV2Response
	}

	async function fetchPlayOptions(programId: string): Promise<ProgramPlayOptionsResponse> {
		const url = `${subUrl}/v3/programs/${encodeURIComponent(programId)}/play-options`
		console.log('[PLAYBACK] 1/4 fetchPlayOptions →', url)
		const res = await fetch(url, {
			headers: { Authorization: auth },
		})

		if (!res.ok) {
			console.error('[PLAYBACK] 1/4 fetchPlayOptions FAILED', { status: res.status, statusText: res.statusText })
			throw new Error(`GetPlayOptions(${programId}) failed: ${res.status}`)
		}
		const json = (await res.json()) as ProgramPlayOptionsResponse
		console.log('[PLAYBACK] 1/4 fetchPlayOptions ←', {
			ProgramId: json.ProgramId,
			vodCount: json.Vods?.length,
			scheduleCount: json.Schedules?.length,
			firstVodPlayActions: json.Vods?.[0]?.PlayActions?.length,
			firstVideoProfile: json.Vods?.[0]?.PlayActions?.[0]?.VideoProfile,
			firstOfferId: json.Vods?.[0]?.PlayActions?.[0]?.OfferId,
			fullResponse: json,
		})
		return json
	}

	/** Live events use a dedicated endpoint (`/v2/events/{id}/play-options`), not the VOD one. */
	async function fetchEventPlayOptions(eventId: string): Promise<EventPlayOptionsResponse> {
		const url = `${subUrl}/v2/events/${encodeURIComponent(eventId)}/play-options`
		console.log('[PLAYBACK] 1/4 fetchEventPlayOptions →', url)
		const res = await fetch(url, { headers: { Authorization: auth } })

		if (!res.ok) throw new Error(`GetEventPlayOptions(${eventId}) failed: ${res.status}`)
		const json = (await res.json()) as EventPlayOptionsResponse
		console.log('[PLAYBACK] 1/4 fetchEventPlayOptions ←', {
			EventId: json.EventId,
			scheduleCount: json.Schedules?.length,
			firstProductionServices: json.Schedules?.[0]?.Productions?.[0]?.Services?.length,
			fullResponse: json,
		})
		return json
	}

	async function fetchPlayers(): Promise<Person[]> {
		const params = new URLSearchParams({
			TenantId: config.tenantId,
			$lang: 'en-US',
		})

		const res = await fetch(`${config.discoveryUrl}/v3/players?${params}`, {
			headers: { Authorization: auth },
		})

		if (!res.ok) throw new Error(`GetPlayers failed: ${res.status}`)
		return personsResponseSchema.parse(await res.json())
	}

	async function fetchContinueWatching(): Promise<SubscriberContinueWatchingResponse | null> {
		if (!userAccessToken || !userProfileId) return null
		const userAuth = authHeader(userAccessToken)
		const params = new URLSearchParams({
			$lang: 'en-US',
			storeId: config.storeId,
			atHome: 'true',
			types: 'Title',
		})

		const res = await fetch(`${subUrl}/v5/libraries/Continue?${params}`, {
			headers: { Authorization: userAuth, 'x-tv3-profiles': userProfileId },
		})

		if (!res.ok) return null
		return (await res.json()) as SubscriberContinueWatchingResponse
	}

	async function putBookmark(input: {
		videoId: string
		programId?: string | null
		timeSeconds: number
		runtimeSeconds: number
	}): Promise<void> {
		if (!userAccessToken || !userProfileId) return
		if (!input.videoId || input.runtimeSeconds <= 0) return

		const userAuth = authHeader(userAccessToken)
		// Per Adil (MK BE, Slack): bookmark endpoints use ?storeId=... and body is { TimeSeconds: <int> } as integer.
		const params = new URLSearchParams({ storeId: config.storeId })

		const body = {
			TimeSeconds: Math.floor(input.timeSeconds),
		}

		// subscriberbkmark is a sibling of /subscriber, not a child — swap the trailing segment.
		const bookmarkBaseUrl = subUrl.replace(/\/subscriber$/, '/subscriberbkmark')
		const url = `${bookmarkBaseUrl}/v3/videos/${encodeURIComponent(input.videoId)}/bookmark?${params}`

		try {
			await fetch(url, {
				method: 'PUT',
				headers: {
					Authorization: userAuth,
					'x-tv3-profiles': userProfileId,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				keepalive: true,
			})
		} catch (err) {
			console.warn('[BOOKMARK] PUT failed', { videoId: input.videoId, err })
		}
	}

	async function getBookmark(videoId: string): Promise<{ TimeSeconds: number } | null> {
		if (!userAccessToken || !userProfileId || !videoId) return null
		const userAuth = authHeader(userAccessToken)
		const params = new URLSearchParams({ storeId: config.storeId })
		const bookmarkBaseUrl = subUrl.replace(/\/subscriber$/, '/subscriberbkmark')
		const url = `${bookmarkBaseUrl}/v3/videos/${encodeURIComponent(videoId)}/bookmark?${params}`
		try {
			const res = await fetch(url, {
				headers: { Authorization: userAuth, 'x-tv3-profiles': userProfileId },
			})
			if (!res.ok) return null
			return (await res.json()) as { TimeSeconds: number }
		} catch (err) {
			console.warn('[BOOKMARK] GET failed', { videoId, err })
			return null
		}
	}

	// ── Public API ──────────────────────────────────────────────

	/**
	 * Shared helper: given a hub, select the hero feed and build the rail list.
	 *
	 * Hero selection priority:
	 *   1. First feed whose ID is in `config.feedDisplayTypes.jumboFeedIds` (Firebase / env override)
	 *   2. First feed with `ShowcardAspectRatio=Carousel`
	 *   3. When neither is configured, fall back to `hub.Feeds[0]`
	 */
	function buildPageFeeds(hub: { Feeds: HubFeed[] }): PageFeedManifest {
		const jumboIds = new Set(config.feedDisplayTypes.jumboFeedIds)

		let heroFeedId: string | null = null
		if (jumboIds.size > 0) {
			heroFeedId = hub.Feeds.find((f) => jumboIds.has(f.Id))?.Id ?? null
		}

		heroFeedId ??= hub.Feeds.find(isHeroCarouselFeed)?.Id ?? null
		heroFeedId ??= hub.Feeds[0]?.Id ?? null

		const feeds: FeedDescriptor[] = hub.Feeds.filter((f) => f.Id !== heroFeedId).map(toFeedDescriptor)

		return { heroFeedId, feeds }
	}

	/**
	 * Fetches hub metadata and returns the page shell (hero feed ID + rail descriptors).
	 *
	 * TODO: Fetch hero feed items here in parallel and return `heroItems` + `heroImageUrl`
	 * so the page RSC can emit `<link rel="preload">` for the hero image (LCP win).
	 * Then replace `getHeroData` with `enrichHeroItems(items)`.
	 * See docs/plans/2026-02-24-loading-optimization-backlog.md §1.
	 */
	async function getPageFeeds(hubId: string): Promise<PageFeedManifest> {
		const hubs = await fetchHubs()
		const hub = hubs.find((h) => h.Id === hubId)
		if (!hub) return { heroFeedId: null, feeds: [] }
		return buildPageFeeds(hub)
	}

	/**
	 * Home page feeds. Resolves the configured hub against the active store in the same
	 * hub fetch, so a store switch cannot leave the page pointing at the previous store's hub.
	 */
	async function getHomePageFeeds(configuredHomeHubId: string): Promise<PageFeedManifest> {
		const hubs = await fetchHubs()
		const homeHubId = resolveHomeHubId(
			configuredHomeHubId,
			hubs.map((hub) => hub.Id),
		)
		const hub = hubs.find((h) => h.Id === homeHubId)
		if (!hub) return { heroFeedId: null, feeds: [] }
		return buildPageFeeds(hub)
	}

	/**
	 * Auto-discovers the hub for `pageId` by matching hub names against keyword patterns,
	 * then delegates to `buildPageFeeds`. Used when no hub ID is configured in env/Firebase.
	 */
	async function autoDiscoverPageFeeds(pageId: string): Promise<PageFeedManifest> {
		if (!(pageId in HUB_KEYWORDS)) return { heroFeedId: null, feeds: [] }
		const keywords = HUB_KEYWORDS[pageId as keyof typeof HUB_KEYWORDS]

		const hubs = await fetchHubs()
		const hub = hubs.find((h) => {
			const name = h.Name.toLowerCase()
			return keywords.some((kw) => name.includes(kw))
		})

		if (!hub) {
			return { heroFeedId: null, feeds: [] }
		}

		return buildPageFeeds(hub)
	}

	/** Fetches hero feed items + series enrichment (synopsis, duration). */
	async function getHeroData(heroFeedId: string): Promise<HeroData | null> {
		const heroItems = await fetchFeedItems(heroFeedId)
		if (heroItems.Items.length === 0) return null

		const seriesDetails = await Promise.all(
			heroItems.Items.map((item) => (item.ItemType === 'Series' ? fetchSeriesDetail(item.Id) : Promise.resolve(null))),
		)

		const enrichment: HeroEnrichment = {}
		for (let i = 0; i < heroItems.Items.length; i++) {
			const item = heroItems.Items[i]
			const detail = seriesDetails[i]
			const runtime = detail?.PriorityEpisodeTitle?.CatalogInfo.RuntimeSeconds
			let synopsis = detail?.CatalogInfo.Description
			if (synopsis?.startsWith(item.Name)) {
				synopsis =
					synopsis
						.slice(item.Name.length)
						.replace(/^[\s:.\-–—]+/, '')
						.trim() || undefined
			}
			enrichment[item.Id] = {
				synopsis,
				...(runtime ? { duration: formatDuration(runtime) } : {}),
			}
		}

		return mapFeedItemsToHero(heroItems, heroImage, enrichment)
	}

	async function getPlayersRail(feed: FeedDescriptor): Promise<RailData | null> {
		try {
			const all = await fetchPlayers()
			if (all.length === 0) return null
			return mapPersonsToRail(feed.id, feed.name, all, playerImage)
		} catch (err) {
			console.warn(`[RAIL] getPlayersRail: dropping rail "${feed.name}" (${feed.id})`, err)
			return null
		}
	}

	/** Fetches and maps a single rail's feed items. Handles continue-watching and standard feeds. */
	/** Live-event feed items carry no start time in the list payload — fetch it per event and tag the card. */
	async function addEventStartTags(rail: RailData, feedItems: DiscoveryFeedItemsResponse): Promise<void> {
		const events = feedItems.Items.filter((i) => i.ItemType === 'Event' || i.ShowType === 'Event')
		if (events.length === 0) return

		const labelById = new Map<string, string>()
		await Promise.all(
			events.map(async (event) => {
				try {
					const options = await fetchEventPlayOptions(event.Id)
					const label = formatEventStartLabel(options.Schedules?.[0]?.StartUtc)
					if (label) labelById.set(event.Id, label)
				} catch (err) {
					// No play-options / start time — leave the card without a tag.
					console.warn(`[RAIL] addEventStartTags: no start time for event ${event.Id}`, err)
				}
			}),
		)

		for (const item of rail.items) {
			const label = labelById.get(item.id)
			if (label) item.startsAt = label
		}
	}

	async function getRailData(feed: FeedDescriptor): Promise<RailData | null> {
		try {
			// Continue Watching — subscriber library
			if (isContinueWatchingUri(feed.uri)) {
				const cw = await fetchContinueWatching()
				if (!cw || cw.LibraryItems.length === 0) return null
				return mapContinueWatchingToRail(cw, cwImage)
			}

			// Other subscriber libraries — skip for now
			if (isSubscriberLibraryUri(feed.uri)) {
				return null
			}

			// Persons cache (1x1 players rail)
			if (isPlayersUri(feed.uri)) {
				return getPlayersRail(feed)
			}

			if (isLiveChannelsUri(feed.uri)) {
				return await fetchPlayableChannelsRail(feed)
			}

			// Standard discovery feed — Dynamic feeds must be called by their URI segment
			// (e.g. `events`), not the GUID, so the backend can resolve them dynamically.
			const feedRequestId = discoveryFeedIdFromUri(feed.uri) ?? feed.id
			const feedItems = await fetchFeedItems(feedRequestId)
			if (feedItems.Items.length === 0) return null

			// Live channels resolve through the channel map, not the catalog.
			if (feedItems.Items.every((item) => item.ItemType === 'Channel')) {
				return await getChannelFeedRail(feed, feedItems.Items)
			}

			const variant = mapFeedToVariant(feed) ?? fallbackVariantFromImages(feedItems)
			const aspect = showcardCardAspect(feed.showcardAspectRatio)

			const rail = mapFeedItemsToRail(feed.id, feed.name, feedItems, variant, feedImage, aspect)
			await addEventStartTags(rail, feedItems)
			const viewAll = buildFeedViewAll(feed)
			if (viewAll) {
				rail.viewAllHref = viewAll.href
				rail.viewAllLabel = viewAll.label
			}
			return rail
		} catch (err) {
			// A thrown rail disappears from the page with no other trace — always say why.
			console.warn(`[RAIL] getRailData: dropping rail "${feed.name}" (${feed.id}, uri=${feed.uri})`, err)
			return null
		}
	}

	/** Fetches live event play options and maps to a normalized TitleDetail (registered SDK mode). */
	async function getEventTitleDetail(eventId: string): Promise<TitleDetail | null> {
		const eventOptions = await fetchEventPlayOptions(eventId)
		const detail = mapEventPlayOptionsToTitleDetail(eventId, eventOptions)
		if (!detail) return null
		detail.authToken = accessToken
		detail.playerServerUrl = config.playerServerUrl
		return detail
	}

	/** Fetches program play options and maps to a normalized TitleDetail. */
	async function getTitleDetail(programId: string): Promise<TitleDetail | null> {
		try {
			const liveChannelTitle = await getPlayableChannelTitleDetail(programId)
			if (liveChannelTitle) return liveChannelTitle

			const playOptions = await fetchPlayOptions(programId)
			const vodTitle = playOptions.Vods[0]
			const scheduleTitle = playOptions.Schedules[0]
			const title = vodTitle ?? scheduleTitle
			if (!title) {
				// No VOD/program asset — this is likely a live event, which uses a different endpoint.
				const eventDetail = await getEventTitleDetail(programId)
				if (eventDetail) return eventDetail
				console.warn('[PLAYBACK] 2/4 getTitleDetail: no Vod/Schedule and no live event play-options')
				return null
			}

			const detail = mapPlayOptionsToTitleDetail(programId, title, vodTitle ? VOD_ASSET_TYPE : EVENT_ASSET_TYPE)
			detail.authToken = accessToken
			detail.playerServerUrl = config.playerServerUrl
			console.log('[PLAYBACK] 2/4 getTitleDetail mapped →', {
				name: detail.name,
				assetType: detail.assetType,
				mediaId: detail.mediaId,
				offerId: detail.offerId,
				ownerUid: detail.ownerUid,
				playbackUrl: detail.playbackUrl,
				playerServerUrl: detail.playerServerUrl,
				authTokenPresent: !!detail.authToken,
				authTokenPrefix: detail.authToken ? `${detail.authToken.slice(0, 20)}…` : null,
			})
			if (!detail.playerServerUrl) {
				console.warn(
					'[PLAYBACK] 2/4 playerServerUrl is EMPTY — registered SDK mode will be skipped, native HLS fallback will be used',
				)
			}
			if (!detail.authToken) {
				console.warn(
					'[PLAYBACK] 2/4 authToken is EMPTY — registered SDK mode will be skipped, native HLS fallback will be used',
				)
			}
			if (!detail.mediaId) {
				console.warn(
					'[PLAYBACK] 2/4 mediaId is EMPTY — registered SDK mode will be skipped, native HLS fallback will be used',
				)
			}
			return detail
		} catch (err) {
			console.error('[PLAYBACK] 2/4 getTitleDetail FAILED', err)
			return null
		}
	}

	/** Finds a feed descriptor by id across all hubs (browse pages only have the feed id). */
	async function findFeedDescriptor(feedId: string): Promise<FeedDescriptor | null> {
		const hubs = await fetchHubs()
		for (const hub of hubs) {
			const feed = hub.Feeds.find((f) => f.Id === feedId)
			if (feed) return toFeedDescriptor(feed)
		}
		return null
	}

	/** Fetches one page of a feed for the View All grid via backend `$skip`/`$top` paging. */
	async function getBrowseRailPage(feedId: string, skip: number): Promise<BrowseRailPage | null> {
		const feed = await findFeedDescriptor(feedId)
		if (!feed) return null

		const feedRequestId = discoveryFeedIdFromUri(feed.uri) ?? feed.id
		const feedItems = await fetchFeedItems(feedRequestId, { skip, top: BROWSE_PAGE_SIZE })

		const variant = mapFeedToVariant(feed) ?? fallbackVariantFromImages(feedItems)
		const aspect = showcardCardAspect(feed.showcardAspectRatio)
		const rail = mapFeedItemsToRail(feed.id, feed.name, feedItems, variant, feedImage, aspect)

		// A full page implies there may be more; a short/empty page is the last one.
		const hasMore = feedItems.Items.length === BROWSE_PAGE_SIZE
		return { rail, hasMore, nextSkip: skip + BROWSE_PAGE_SIZE }
	}

	return {
		getPageFeeds,
		getHomePageFeeds,
		autoDiscoverPageFeeds,
		getHeroData,
		getRailData,
		getBrowseRailPage,
		getTitleDetail,
		fetchHubs,
		fetchFeedItems,
		putBookmark,
		getBookmark,
	}
}
