/**
 * Client-safe environment configuration.
 *
 * Reads mostly `NEXT_PUBLIC_*` vars. On the server, `MK_USER_ACCESS_TOKEN`
 * is preferred over the public demo fallback.
 *
 * SECURITY BOUNDARY:
 * - `NEXT_PUBLIC_*` values are visible in the browser JS bundle — treat as public.
 * - The public user token fallback is only for local sales-demo runs behind the login wall.
 * - For production apps, auth tokens should be obtained at runtime, not baked into the bundle.
 */

/**
 * One switchable demo account. Only the token is required — the display name and
 * e-mail are resolved from the MK API at runtime (`/sts/bootstrap` → `AccountId`,
 * `/subscriber/v1/profiles` → `Name`). `name` is an optional presentation override.
 */
export type MkAccountConfig = {
	token: string
	name?: string
	avatarUrl?: string
}

export type ClientEnv = {
	/** 'mock' uses TMDB demo data, 'api' fetches from live MK API. */
	dataSource: 'mock' | 'api'
	/** MK API gateway host (e.g. https://ottapp-appgw-client-a.prodc.dtc.tv3cloud.com) */
	mkApiHost: string
	/** MK tenant identifier (e.g. tenant2) */
	mkTenantId: string
	/** MK store ID for feed/hub scoping */
	mkStoreId: string
	/** Stores the switcher may offer. Empty shows every store the tenant returns. */
	mkVisibleStores: string[]
	/** Home hub ID — determines which hub renders at "/" */
	mkHomeHubId: string
	/** Feed IDs rendered as jumbo/hero rails */
	mkJumboFeedIds: string[]
	/** Subscriber access token — enables full content visibility + continue watching */
	mkUserAccessToken: string | null
	/** Switchable demo accounts. Empty when the account switcher is not configured. */
	mkAccounts: MkAccountConfig[]
}

/**
 * Parses `NEXT_PUBLIC_MK_ACCOUNTS`. Accepts either a JSON array
 * (`[{"token":"…","name":"…"}]`) or a plain comma-separated list of tokens.
 * Malformed entries are dropped rather than throwing — a broken var must not
 * take down the whole app on a demo machine.
 */
export function parseMkAccounts(raw: string | undefined): MkAccountConfig[] {
	const value = raw?.trim()
	if (!value) return []

	if (value.startsWith('[')) {
		try {
			const parsed = JSON.parse(value)
			if (!Array.isArray(parsed)) return []
			return parsed.flatMap((entry): MkAccountConfig[] => {
				if (typeof entry === 'string') return entry.trim() ? [{ token: entry.trim() }] : []
				if (!entry || typeof entry !== 'object') return []
				const token = typeof entry.token === 'string' ? entry.token.trim() : ''
				if (!token) return []
				const name = typeof entry.name === 'string' ? entry.name.trim() : ''
				const avatarUrl = typeof entry.avatarUrl === 'string' ? entry.avatarUrl.trim() : ''
				return [{ token, ...(name && { name }), ...(avatarUrl && { avatarUrl }) }]
			})
		} catch {
			console.warn('[env] NEXT_PUBLIC_MK_ACCOUNTS is not valid JSON — account switcher disabled')
			return []
		}
	}

	return value
		.split(',')
		.map((token) => token.trim())
		.filter(Boolean)
		.map((token) => ({ token }))
}

let _cached: ClientEnv | null = null

/**
 * Returns the client-safe env config. Cached after first call.
 *
 * In mock mode, MK_ vars may be empty (not used).
 * In api mode, use {@link assertApiEnv} to validate required fields.
 */
export function getClientEnv(): ClientEnv {
	if (_cached) return _cached

	const raw = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'
	if (raw !== 'mock' && raw !== 'api') {
		throw new Error(`Invalid NEXT_PUBLIC_DATA_SOURCE="${raw}". Expected "mock" or "api".`)
	}

	const rawUserAccessToken = process.env.MK_USER_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MK_USER_ACCESS_TOKEN || ''

	_cached = {
		dataSource: raw,
		mkApiHost: process.env.NEXT_PUBLIC_MK_API_HOST ?? '',
		mkTenantId: process.env.NEXT_PUBLIC_MK_TENANT_ID ?? '',
		mkStoreId: process.env.NEXT_PUBLIC_MK_STORE_ID ?? '',
		mkVisibleStores: (process.env.NEXT_PUBLIC_MK_VISIBLE_STORES ?? '')
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean),
		mkHomeHubId: process.env.NEXT_PUBLIC_MK_HOME_HUB_ID ?? '',
		mkJumboFeedIds: (process.env.NEXT_PUBLIC_MK_JUMBO_FEED_IDS ?? '').split(',').filter(Boolean),
		mkUserAccessToken: rawUserAccessToken.trim() || null,
		mkAccounts: parseMkAccounts(process.env.NEXT_PUBLIC_MK_ACCOUNTS),
	}

	return _cached
}

/**
 * Validates that API-mode required vars are present.
 * Throws with clear error listing all missing vars.
 *
 * Call at the start of API data paths (boot, provider init).
 */
export function assertApiEnv(): ClientEnv {
	const env = getClientEnv()

	const missing: string[] = []
	if (!env.mkApiHost) missing.push('NEXT_PUBLIC_MK_API_HOST')
	if (!env.mkTenantId) missing.push('NEXT_PUBLIC_MK_TENANT_ID')

	if (missing.length > 0) {
		throw new Error(`API mode requires: ${missing.join(', ')}. Set in .env or CI variables.`)
	}

	return env
}

/** Reset cached config. Only needed in tests. */
export function _resetClientEnvCache(): void {
	_cached = null
}
