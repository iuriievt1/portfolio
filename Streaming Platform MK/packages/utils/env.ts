// ── Registry ────────────────────────────────────────
const serverEnvVars = [
	'DATA_SOURCE',
	'MK_API_HOST',
	'MK_TENANT_ID',
	'MK_STORE_ID',
	'MK_CONTENT_TENANT_ID',
	'MK_CONTENT_HOME_HUB_ID',
	'FIREBASE_API_KEY',
	'FIREBASE_PROJECT_ID',
	'FIREBASE_APP_ID',
	'MK_HOME_HUB_ID',
	'MK_SPORTS_HUB_ID',
	'MK_KIDS_HUB_ID',
	'MK_JUMBO_FEED_IDS',
	'MK_USER_ACCESS_TOKEN',
	'NEXT_PUBLIC_BASE_URL',
] as const

export type ServerEnvVar = (typeof serverEnvVars)[number]

// ── Getters ─────────────────────────────────────────
export type DataSource = 'mock' | 'api'

/** Returns the validated DATA_SOURCE toggle. Throws on invalid values. */
export function getDataSource(): DataSource {
	const raw = process.env.DATA_SOURCE ?? 'mock'
	if (raw === 'mock' || raw === 'api') return raw
	throw new Error(`Invalid DATA_SOURCE="${raw}". Expected "mock" or "api".`)
}

/** Returns the env var value or throws with a clear message. */
export function requireEnv(key: ServerEnvVar): string {
	const val = process.env[key]
	if (!val) throw new Error(`Missing required env var: ${key}`)
	return val
}

/** Returns the env var value or null. Use for optional overrides. */
export function optionalEnv(key: ServerEnvVar): string | null {
	return process.env[key] ?? null
}

/**
 * Validates env vars for the API data source.
 * Either MK_API_HOST + MK_TENANT_ID (direct), or all three FIREBASE_* vars.
 * Throws with a specific message if neither group is satisfied.
 */
export function validateApiEnv(): {
	mkApiHost: string
	tenantId: string
	firebase: { apiKey: string; projectId: string; appId: string } | null
} {
	const direct = optionalEnv('MK_API_HOST')
	const tenantId = direct ? requireEnv('MK_TENANT_ID') : optionalEnv('MK_TENANT_ID')

	if (direct && tenantId) {
		return { mkApiHost: direct, tenantId, firebase: null }
	}

	return {
		mkApiHost: '',
		tenantId: tenantId ?? '',
		firebase: {
			apiKey: requireEnv('FIREBASE_API_KEY'),
			projectId: requireEnv('FIREBASE_PROJECT_ID'),
			appId: requireEnv('FIREBASE_APP_ID'),
		},
	}
}
