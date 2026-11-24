import { assertApiEnv } from '@pkg/utils/client-env'
import { getActiveUserAccessToken } from './active-account'
import { getActiveStoreId } from './active-store'
import { appConfigSchema } from './schemas'
import type { AppConfig, StsBootstrapResponse, StsOauthJwtSignInResponse } from './types'

export function authHeader(accessToken: string) {
	return `OAUTH2 access_token="${accessToken}"`
}

/**
 * In browser dev mode, rewrite absolute MK API URLs to go through the
 * Next.js dev proxy (/mk-api/*) configured in next.config.ts, bypassing CORS.
 * In all other contexts (Node.js build, production browser), returns the URL as-is.
 */
export function devProxyUrl(absoluteUrl: string): string {
	if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return absoluteUrl
	try {
		const parsed = new URL(absoluteUrl)
		return `/mk-api${parsed.pathname}${parsed.search}`
	} catch (err) {
		console.warn(`[MK API] devProxyUrl: not a valid URL, using as-is: ${absoluteUrl}`, err)
		return absoluteUrl
	}
}

function catalogCacheUrlFromBootstrap(bootstrap: StsBootstrapResponse, mkApiHost: string): string {
	const services = bootstrap.ServiceMap.Services
	return (
		services.catalogCache ??
		services.catalogcache ??
		services.channelMapSlabs ??
		services.channelMapCache ??
		`${mkApiHost.replace(/\/$/, '')}/catalogcache`
	)
}

function channelMapIdFromBootstrap(bootstrap: StsBootstrapResponse): number | null {
	if (bootstrap.ChannelMapId == null || bootstrap.ChannelMapId === '') return null
	const id = Number(bootstrap.ChannelMapId)
	return Number.isFinite(id) ? id : null
}

async function getAnonymousToken(
	mkApiHost: string,
	tenantId: string,
): Promise<{ accessToken: string; expiresAt: number }> {
	const url = devProxyUrl(`${mkApiHost}/sts/v1/oauth/jwtsignin?tenant=${encodeURIComponent(tenantId)}`)
	const res = await fetch(url, {
		method: 'GET',
		headers: { 'X-TV3-TenantId': tenantId },
	})

	if (!res.ok) throw new Error(`Anonymous token failed: ${res.status} ${res.statusText}`)

	const data = (await res.json()) as StsOauthJwtSignInResponse
	if (!data.AccessToken) throw new Error('Anonymous token failed: no AccessToken in response')

	const expiresAt = data.ExpiryTime ? new Date(data.ExpiryTime).getTime() : Date.now() + 3600_000
	return { accessToken: data.AccessToken, expiresAt }
}

export async function getBootstrap(
	mkApiHost: string,
	accessToken: string,
	tenantId: string,
): Promise<StsBootstrapResponse> {
	const params = new URLSearchParams({
		$lang: 'en-US',
		deviceType: 'AndroidStb',
		TenantId: tenantId,
	})

	const res = await fetch(devProxyUrl(`${mkApiHost}/sts/bootstrap?${params}`), {
		headers: { Authorization: authHeader(accessToken) },
	})

	if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`)

	return (await res.json()) as StsBootstrapResponse
}

async function getLocationLookup(subscriberUrl: string, accessToken: string): Promise<string> {
	const res = await fetch(`${subscriberUrl}/v1/location-lookup`, {
		headers: { Authorization: authHeader(accessToken) },
	})

	if (!res.ok) throw new Error(`Location lookup failed: ${res.status}`)

	const data = await res.json()
	const json = JSON.stringify(data)
	return btoa(unescape(encodeURIComponent(json)))
}

/**
 * Bootstraps the MK API session: anon token → bootstrap → location.
 * Works in both server (Node.js) and browser contexts.
 *
 * When `tenantOverride` is provided, boots against that tenant instead of
 * the default MK_TENANT_ID.
 */
type BootResult = {
	config: AppConfig
	accessToken: string
	expiresAt: number
	userAccessToken: string | null
	userProfileId: string | null
}

export async function boot(tenantOverride?: string): Promise<BootResult> {
	const env = assertApiEnv()

	const mkApiHost = env.mkApiHost
	const tenantId = tenantOverride || env.mkTenantId

	let accessToken: string
	let expiresAt: number
	let bootstrap: StsBootstrapResponse
	let locationDetail: string

	try {
		;({ accessToken, expiresAt } = await getAnonymousToken(mkApiHost, tenantId))
	} catch (e) {
		console.error('[MK API] Anonymous token request failed', { mkApiHost, tenantId, error: e })
		throw new Error(`[MK API] Failed to get anonymous token from ${mkApiHost}: ${e instanceof Error ? e.message : e}`, {
			cause: e,
		})
	}

	try {
		bootstrap = await getBootstrap(mkApiHost, accessToken, tenantId)
	} catch (e) {
		console.error('[MK API] Bootstrap request failed', { mkApiHost, tenantId, error: e })
		throw new Error(`[MK API] Bootstrap failed for ${mkApiHost}: ${e instanceof Error ? e.message : e}`, { cause: e })
	}

	const subscriberUrl = devProxyUrl(bootstrap.ServiceMap.Services.subscriber)
	const discoveryUrl = devProxyUrl(bootstrap.ServiceMap.Services.discovery)
	const catalogCacheUrl = devProxyUrl(catalogCacheUrlFromBootstrap(bootstrap, mkApiHost))

	// Account switcher selection wins; otherwise the NEXT_PUBLIC_ demo token (visible in bundle, behind login wall).
	const userAccessToken = getActiveUserAccessToken() ?? env.mkUserAccessToken

	// Location + user bootstrap are independent — run in parallel
	const locationPromise = getLocationLookup(subscriberUrl, accessToken).catch((e) => {
		console.error('[MK API] Location lookup failed', { subscriberUrl, error: e })
		throw new Error(`[MK API] Location lookup failed: ${e instanceof Error ? e.message : e}`, { cause: e })
	})
	const userBootstrapPromise = userAccessToken
		? getBootstrap(mkApiHost, userAccessToken, tenantId).catch((e) => {
				console.warn('[MK API] User token bootstrap failed, falling back to anonymous groups', e)
				return null
			})
		: Promise.resolve(null)

	const [locationResult, userBootstrapResult] = await Promise.all([locationPromise, userBootstrapPromise])
	locationDetail = locationResult

	// A user token whose bootstrap was rejected is dead (expired/invalid). Keeping it
	// would 401 every downstream call, so drop it entirely and run anonymous — the demo
	// loses personalised rails but still renders. See "Token Management" in the MVP spec.
	const userTokenIsUsable = userAccessToken != null && userBootstrapResult != null
	if (userAccessToken && !userBootstrapResult) {
		console.error('[MK API] User token rejected — falling back to anonymous, personalised content will be hidden')
	}
	const effectiveUserAccessToken = userTokenIsUsable ? userAccessToken : null

	let userProfileId: string | null = null
	let effectiveGroups = bootstrap.RightsGroupIds
	let effectiveProfileId = bootstrap.DefaultProfileId
	if (userBootstrapResult) {
		userProfileId = userBootstrapResult.DefaultProfileId
		effectiveGroups = userBootstrapResult.RightsGroupIds
		effectiveProfileId = userBootstrapResult.DefaultProfileId
	}

	console.log('[PLAYBACK] 0/4 bootstrap ServiceMap.Services', {
		defaultAccHostName: bootstrap.ServiceMap.Services.defaultAccHostName,
		sts: bootstrap.ServiceMap.Services.sts,
		search: bootstrap.ServiceMap.Services.search,
		image: bootstrap.ServiceMap.Services.image,
		fullServices: bootstrap.ServiceMap.Services,
	})
	if (!bootstrap.ServiceMap.Services.defaultAccHostName) {
		console.warn(
			'[PLAYBACK] 0/4 bootstrap returned NO defaultAccHostName — playerServerUrl will be empty, SDK registered mode CANNOT engage',
		)
	}

	const config = appConfigSchema.parse({
		mkApiHost,
		tenantId,
		storeId: getActiveStoreId() ?? env.mkStoreId,
		imageBaseUrl: bootstrap.ServiceMap.Services.image,
		groups: effectiveGroups,
		profileId: effectiveProfileId,
		locationDetail,
		discoveryUrl,
		subscriberServiceUrl: subscriberUrl,
		catalogCacheUrl,
		searchServiceUrl: devProxyUrl(bootstrap.ServiceMap.Services.search ?? ''),
		stsServiceUrl: devProxyUrl(bootstrap.ServiceMap.Services.sts ?? ''),
		playerServerUrl: bootstrap.ServiceMap.Services.defaultAccHostName ?? '',
		channelMapId: channelMapIdFromBootstrap(userBootstrapResult ?? bootstrap),
		navHubIds: {
			home: env.mkHomeHubId,
		},
		feedDisplayTypes: {
			jumboFeedIds: env.mkJumboFeedIds,
			characterFeedIds: [],
		},
		continueWatchingUdl: '',
		favouritesUdl: '',
	})

	return {
		config,
		accessToken: effectiveUserAccessToken || accessToken,
		expiresAt,
		userAccessToken: effectiveUserAccessToken,
		userProfileId,
	}
}
