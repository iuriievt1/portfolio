/**
 * Lists the HubsAndFeeds stores available in the tenant so the demo can be
 * re-pointed without a redeploy. Nothing is hardcoded — the list comes from
 * `/discovery/v3/stores`, which lets MK spin stores up and down freely.
 */

import { assertApiEnv } from '@pkg/utils/client-env'
import { authHeader, devProxyUrl, getBootstrap } from './boot'

type DiscoveryStore = {
	Id?: string
	StoreType?: string
	IsDefault?: boolean
}

export type StoreOption = {
	/** Full MK store id, e.g. `HubsAndFeeds-!tenant1!New Demo App`. */
	id: string
	/** Everything after the last `!`, e.g. `New Demo App`. */
	label: string
}

/**
 * Per MK: display everything after the last `!` in the store id.
 * `HubsAndFeeds-!tenant1!New Demo App` → `New Demo App`.
 */
export function storeLabelFromId(storeId: string): string {
	const trimmed = storeId.trim()
	const lastSeparator = trimmed.lastIndexOf('!')
	if (lastSeparator < 0) return trimmed

	return trimmed.slice(lastSeparator + 1).trim() || trimmed
}

/**
 * Narrows the list to the stores named in `NEXT_PUBLIC_MK_VISIBLE_STORES`. An entry
 * matches either the label (`IBC Sports`) or the full store id. An empty allowlist
 * shows everything; one that matches nothing falls back to the full list, so a typo
 * in a CI variable cannot blank the switcher.
 */
export function filterVisibleStores(stores: StoreOption[], allowlist: string[]): StoreOption[] {
	const allowed = new Set(allowlist.map((entry) => entry.trim().toLowerCase()).filter(Boolean))
	if (allowed.size === 0) return stores

	const visible = stores.filter(
		(store) => allowed.has(store.label.toLowerCase()) || allowed.has(store.id.toLowerCase()),
	)
	if (visible.length === 0 && stores.length > 0) {
		console.warn('[stores] Allowlist matched no store, showing every store instead', {
			allowlist,
			available: stores.map((store) => store.label),
		})
		return stores
	}

	return visible
}

/**
 * Fetches the tenant's stores. Returns an empty list on failure — the app keeps
 * running on its configured store, it just cannot offer a switch.
 */
export async function fetchStores(): Promise<StoreOption[]> {
	const env = assertApiEnv()

	try {
		// Anonymous is enough here: the store list is not account-scoped, and using it
		// keeps the list intact even when the selected account's token is dead.
		const token = await anonymousToken(env.mkApiHost, env.mkTenantId)
		const bootstrap = await getBootstrap(env.mkApiHost, token, env.mkTenantId)
		const discoveryUrl = devProxyUrl(bootstrap.ServiceMap.Services.discovery)

		// Tenant in the query, not a header — discovery's CORS allow-list has no tenant header.
		const params = new URLSearchParams({
			$groups: bootstrap.RightsGroupIds,
			$lang: 'en-US',
			TenantId: env.mkTenantId,
		})
		const res = await fetch(`${discoveryUrl.replace(/\/$/, '')}/v3/stores?${params}`, {
			headers: { Authorization: authHeader(token) },
		})

		if (!res.ok) {
			console.warn('[stores] Store list request failed, switcher will show the configured store only', {
				status: res.status,
				statusText: res.statusText,
			})
			return []
		}

		const stores = (await res.json()) as DiscoveryStore[]
		if (!Array.isArray(stores)) {
			console.warn('[stores] Store list response was not an array', { stores })
			return []
		}

		const options = stores.flatMap((store) => {
			const id = typeof store.Id === 'string' ? store.Id.trim() : ''
			if (!id) return []
			return [{ id, label: storeLabelFromId(id) }]
		})

		return filterVisibleStores(options, env.mkVisibleStores)
	} catch (err) {
		console.warn('[stores] Store list lookup threw, switcher will show the configured store only', err)
		return []
	}
}

async function anonymousToken(mkApiHost: string, tenantId: string): Promise<string> {
	const url = devProxyUrl(`${mkApiHost}/sts/v1/oauth/jwtsignin?tenant=${encodeURIComponent(tenantId)}`)
	const res = await fetch(url, { headers: { 'X-TV3-TenantId': tenantId } })
	if (!res.ok) throw new Error(`Anonymous token failed: ${res.status} ${res.statusText}`)

	const data = (await res.json()) as { AccessToken?: string }
	if (!data.AccessToken) throw new Error('Anonymous token failed: no AccessToken in response')
	return data.AccessToken
}
