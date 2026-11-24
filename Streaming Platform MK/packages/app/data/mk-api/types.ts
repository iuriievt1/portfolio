import type { MKSourceConfig } from '@mediakind/mkplayer'
import type { RailData } from '@pkg/design-system'

/** MK API DTO types — minimal subset needed for discovery + image resolution. */

/** Anonymous JWT sign-in response from `/sts/v1/oauth/jwtsignin`. */
export type StsOauthJwtSignInResponse = {
	AccessToken: string
	ExpiryTime: string
	TokenIdentifier: string
}

/** Bootstrap response from `/sts/bootstrap` — service URLs, rights, profile. */
export type StsBootstrapResponse = {
	/** Account username (usually an e-mail). Only returned for user tokens, not anonymous ones. */
	AccountId?: string
	DefaultProfileId: string
	ProfileIds: string[]
	ChannelMapId?: number | string
	ChannelMapGroupName?: string
	SubscriberGroupIds?: string
	ServiceMap: {
		Services: {
			discovery: string
			subscriber: string
			image: string
			search: string
			sts: string
			catalogCache?: string
			catalogcache?: string
			channelMapSlabs?: string
			channelMapCache?: string
			defaultAccHostName?: string
			[key: string]: string | undefined
		}
	}
	RightsGroupIds: string
}

/** A single catalog item from the discovery feed. */
export type Item = {
	Id: string
	Name: string
	ItemType: string
	ShowType: string
	/** e.g. `["16x9/carousel1", "16x9/keyart", "2x3/poster"]` — omitted entirely when the item has no artwork. */
	SupportedImages?: string[]
	ImageBucketId: string
	Ratings?: { System: string; Value: string }[]
	IsAdult: boolean
	IsGeneric: boolean
}

/** Response from `/discovery/v4/feeds/{feedId}/items`. */
export type DiscoveryFeedItemsResponse = {
	Uri: null | string
	Items: Item[]
}

/** One page of a browse rail. `nextSkip` is the `$skip` offset for the next page; `hasMore` gates further fetches. */
export type BrowseRailPage = { rail: RailData; hasMore: boolean; nextSkip: number }

/** A player/person entry from `/discovery/v3/players`. */
export type Player = {
	Id: string
	ExternalId?: string
	Name: string
	Type?: string
	SportsType?: string
	FirstName?: string
	LastName?: string
	SupportedImages: string[]
	ImageBucketId: string
}

/** Response from `/discovery/v3/players`. */
export type DiscoveryPlayersResponse = Player[]

/** Channel map slab used by playable live channels. */
export type ChannelMapResponse = {
	Channels?: ChannelMapChannel[]
	ServiceCollections?: ChannelMapServiceCollection[]
	Services?: ChannelMapService[]
}

export type ChannelMapImage = {
	Uri?: string
	Url?: string
	ImageType?: string
	Size?: string
}

export type ChannelMapChannel = {
	Id?: string | number
	ChannelNumber: number | string
	ServiceCollectionId?: number | string
	StationId?: string | number
	Name?: string
	CallLetters?: string
	Images?: ChannelMapImage[]
	IsAdult?: boolean
	IsApplication?: boolean
	LocalizedStoresIds?: string[]
}

export type ChannelMapServiceCollection = {
	Id: number | string
	ServiceItems?: {
		ServiceId: number | string
		ServiceGrouping?: number
	}[]
}

export type ChannelMapService = {
	Id: number | string
	Type?: string
	ServiceIntent?: string
	QualityLevel?: string
	MediaId?: string
	OwnerId?: string
}

export type LiveRight = {
	q?: string
	r?: string | string[]
}

export type LiveRightsResponse = {
	accountId?: string
	channelMapId?: number
	channels?: Record<string, LiveRight[]>
	Channels?: Record<string, LiveRight[]>
}

export type IpStatusResponse = {
	InHome?: 'Yes' | 'No' | 'DoNotKnow' | string
	InCountry?: 'Yes' | 'No' | 'DoNotKnow' | string
	IsContentPortabilityRoaming?: boolean
	ReportBackRadius?: number
}

export type PlayableChannel = {
	id: string
	title: string
	channelLabel: string
	showLabel: string
	channelNumber: number
	imageUrl: string
	mediaId?: string
	ownerId?: string
	serviceCollectionId?: string
	/** Discovery feeds identify a channel by this id — see `getChannelFeedRail`. */
	stationId?: string
	/** True when this channel is a multiview mosaic stream (see mk-api/multiview.ts). */
	isMultiview?: boolean
	/** Feed count for the card badge; undefined when the stream's name does not say. */
	multiviewFeedCount?: number
}

/** A single feed entry within a hub. */
type Feed = {
	Id: string
	Name: string
	Uri: string
	FeedType?: 'Dynamic' | 'Custom'
	Layout?: 'Gallery' | 'Category'
	ShowcardAspectRatio?: string
	DefaultSortType?: string
	NavigationTargetUri?: string
	NavigationTargetText?: string
	NavigationTargetVisibility?: string
}

/** A navigation hub containing ordered feeds. */
type Hub = {
	Id: string
	Name: string
	Feeds: Feed[]
}

/** Response from `/discovery/v3/hubs`. */
export type DiscoveryHubsResponse = Hub[]

export type SubscriberSeriesV2Response = {
	CatalogInfo: {
		Id: string
		Name: string
		Description: string
		ImageBucketId: string
		SupportedImages: string[]
	}
	PriorityEpisodeTitle: {
		CatalogInfo: {
			RuntimeSeconds?: number
			Name: string
			EpisodeName: string
		}
	} | null
}

export type SubscriberContinueWatchingResponse = {
	/** Real API returns `Libraries`. The legacy `Libaries` key is tolerated for older responses. */
	Libraries?: { Id: string; Name?: string; Description?: string; ItemCount?: number; LibraryItems?: unknown[] }[]
	Libaries?: Record<string, string>
	LibraryItems: {
		Id: string
		ItemType: string
		IsPinned?: boolean
		IsEpisodeHidden: boolean
		Bookmark?: {
			TimeSeconds: number
			ProgramId: string
			EpisodeNumber?: number
			BookmarkType: string
			Id: string
			SeasonId?: string
			RuntimeSeconds: number
		}
		PlayActions: {
			OfferId: string
			ExternalOfferId: string
			VideoProfile: {
				PlaybackUri: string
				PlaybackOrigin: string
				Id: string
				Owner: string
				Encoding: string
				QualityLevel: string
				ClientType: string
			}
			ExpirationUtc: string
			TimeToExpiry: string
			HoursToExpiry: number
			StartUtc: string
			TransactionType: string
		}[]
		CatalogInfo: {
			Name: string
			ShowType: string
			UniversalProgramId: string
			RuntimeSeconds: number
			Ratings?: { System: string; Value: string }[]
			Tags?: string[]
			IsAdult?: boolean
			SeriesId?: string
			EpisodeName?: string
			SeasonNumber?: number
			SeasonId?: string
			EpisodeNumber?: string
			Locale?: string
			HasContentAdvisory?: boolean
			AvailableUtc?: string
			ImageBucketId: string
			SupportedImages: string[]
			/** Direct image URIs returned by the API — preferred over SupportedImages resolution when present. */
			Images?: CatalogImage[]
		}
		IsContentRestrictedForGeolocation: boolean
		IsContentFree: boolean
		IsLastChance: boolean
	}[]
}

// ── Play Options ────────────────────────────────────────────────

/** Video profile within a play action — contains the actual stream URL. */
export type VideoProfile = {
	PlaybackUri: string
	PlaybackOrigin: string
	IsEncrypted?: boolean
	Id: string
	Owner: string
	Encoding: string
	QualityLevel: string
	ClientType: string
	AudioTags?: Record<string, string | null>
	Tags?: string[]
}

/** A single play action (one video profile + offer metadata). */
export type PlayAction = {
	OfferId: string
	ExternalOfferId: string
	VideoProfile: VideoProfile
	ExpirationUtc: string
	TimeToExpiry: string
	HoursToExpiry: number
	StartUtc: string
	Restrictions: string[]
	Terms?: string
	TveResourceIds?: string[]
	IsLowLatencyEnabledOffer?: boolean
}

/** Image entry from the program catalog. */
export type CatalogImage = {
	Size: string
	ImageType: string
	Uri: string
}

/** Catalog info from the subscriber program response. */
export type ProgramCatalogInfo = {
	Name: string
	ShowType: string
	UniversalProgramId: string
	RuntimeSeconds: number
	Ratings?: { System: string; Value: string }[]
	Tags?: string[]
	IsAdult: boolean
	ReleaseYear?: number
	Description?: string
	Locale?: string
	HasContentAdvisory?: boolean
	AvailableUtc?: string
	Images?: CatalogImage[]
	ImageBucketId?: string
	SupportedImages?: string[]
	SeriesId?: string
	EpisodeName?: string
	SeasonNumber?: number
	SeasonId?: string
	EpisodeNumber?: string
}

/** A single VOD title from `/programs/{id}/titles` or `/v3/programs/{id}/play-options`. */
export type ProgramTitle = {
	Id: string
	ItemType: string
	IsPinned: boolean
	IsEpisodeHidden: boolean
	PlayActions: PlayAction[]
	IsGeoBlocked?: boolean
	CatalogInfo: ProgramCatalogInfo
	IsContentRestrictedForGeolocation?: boolean
	IsContentFree?: boolean
	IsLastChance?: boolean
	Bookmark?: {
		TimeSeconds: number
		ProgramId: string
		EpisodeNumber: number
		BookmarkType: string
		Id: string
		SeasonId: string
		RuntimeSeconds: number
	}
}

/** Response from `/v3/programs/{programId}/play-options`. */
export type ProgramPlayOptionsResponse = {
	ProgramId: string
	Vods: ProgramTitle[]
	Schedules: ProgramTitle[]
	DownloadsCountByAsset: unknown[]
}

/** Response from `/programs/{programId}/titles`. */
export type ProgramTitlesResponse = ProgramTitle[]

/** A playable service inside a live event production. */
export type EventService = {
	Id: string
	IsValid: boolean
	Type: string
	HostName: string
	OwnerId: string
	MediaId: string
	QualityLevel: string
}

/** A purchase/play offer on a live event production (no VideoProfile, unlike VOD). */
export type EventPlayAction = {
	OfferId: string
	ExternalOfferId?: string
	ExpirationUtc?: string
	StartUtc?: string
	TransactionType?: string
}

/** A production (feed) within a live event schedule. */
export type EventProduction = {
	Id: string
	ExternalId: string
	DisplayName?: { Culture: string; Value: string }[]
	Role: string
	Services: EventService[]
	PlayActions: EventPlayAction[]
	IsContentRestrictedForGeolocation?: boolean
}

/** A scheduled airing of a live event, with playable productions. */
export type EventSchedule = {
	StartUtc: string
	EndUtc: string
	ActualStartUtc?: string
	ActualEndUtc?: string
	Name: string
	EventType?: string
	Productions: EventProduction[]
}

/** Response from `/v2/events/{eventId}/play-options` (live events, not VOD). */
export type EventPlayOptionsResponse = {
	EventId: string
	Schedules: EventSchedule[]
	Vods: unknown[]
}

/** Normalized title detail used by the UI layer. */
/** One composite of a mosaic, with a given feed enlarged into the big tile. */
export type MultiviewSpotlight = {
	/**
	 * Canonical source this variant enlarges — the order the base variant composites them in.
	 * Not the variant's own audio key: those are positional (see mk-api/multiview.ts).
	 */
	feedKey: string
	mediaId: string
	/** ServiceCollectionId of the variant's own channel. */
	applicationToken?: string
	ownerUid?: string
}

export type TitleDetail = {
	id: string
	name: string
	showType: string
	assetType?: MKSourceConfig['assetType']
	year?: number
	runtime?: string
	runtimeSeconds?: number
	synopsis?: string
	rating?: string
	isAdult: boolean
	imageUrl?: string
	images: CatalogImage[]
	playbackUrl?: string
	playbackExpires?: string
	playActions: PlayAction[]
	isGeoBlocked?: boolean
	isContentFree?: boolean
	/** ProgramTitle.Id from play-options Vods[0].Id — used as videoId for subscriber bookmark PUTs */
	assetId?: string
	/** VideoProfile.Id — used as mediaId for registered source playback */
	mediaId?: string
	/** PlayAction.OfferId — passed to MKPlayer registered source backend requests */
	offerId?: string
	/** VideoProfile.Owner — used as ownerUid for registered source playback */
	ownerUid?: string
	/** ServiceCollectionId — passed as applicationToken for live channel/event playback */
	applicationToken?: string
	/**
	 * The mosaic's spotlight variants, this channel included. A 3-up is composited once per
	 * enlarged feed and MK ships each as its own channel, so switching spotlight means loading a
	 * different stream. Empty for a mosaic MK ships without variants, and for everything else.
	 */
	multiviewSpotlights?: MultiviewSpotlight[]
	/** STS access token for player authentication */
	authToken?: string
	/** AMP gateway URL from bootstrap (defaultAccHostName) */
	playerServerUrl?: string
	/** Live event schedule start (ISO UTC) — used to gate playback to its window */
	startUtc?: string
	/** Live event schedule end (ISO UTC) — used to gate playback to its window */
	endUtc?: string
}

/** Lightweight feed metadata extracted from a hub (no items). */
export type FeedDescriptor = {
	id: string
	name: string
	uri: string
	feedType?: 'Dynamic' | 'Custom'
	layout?: 'Gallery' | 'Category'
	showcardAspectRatio?: string
	defaultSortType?: string
	navigationTargetUri?: string
	navigationTargetText?: string
	navigationTargetVisibility?: string
}

/** Tenant-specific configuration resolved during boot. Derived from Zod schema. */
export type { AppConfig } from './schemas'

/**
 * Page feed manifest returned by `getPageFeeds()` — enough to render the page skeleton.
 *
 * TODO: Fetch hero feed items during shell phase and return `heroItems` + `heroImageUrl`
 * so the page RSC can emit `<link rel="preload">` for LCP. See loading-optimization-backlog.md §1.
 */
export type PageFeedManifest = {
	heroFeedId: string | null
	feeds: FeedDescriptor[]
}
