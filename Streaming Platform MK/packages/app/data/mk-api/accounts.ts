/**
 * Resolves who a demo account token belongs to. Nothing about the accounts is
 * hardcoded: `/sts/bootstrap` returns `AccountId` (the MK username) and
 * `/subscriber/v1/profiles` returns the profile `Name`.
 */

import { assertApiEnv } from '@pkg/utils/client-env'
import { authHeader, devProxyUrl, getBootstrap } from './boot'

/** Profile name MK assigns when the account has never been renamed — not worth showing. */
const PLACEHOLDER_PROFILE_NAME = 'default'

export type AccountIdentity = {
	/** MK `AccountId` — the account username, usually an e-mail address. */
	accountId: string
	profileId: string | null
	/** Profile name from the subscriber service, when the account has a meaningful one. */
	profileName: string | null
}

type SubscriberProfile = {
	Id?: string
	Name?: string
}

/**
 * Turns an account id into something presentable when no profile name exists:
 * `MK-Test-Acc-Demo-1@outlook.com` → `MK-Test-Acc-Demo-1`.
 */
export function displayNameFromAccountId(accountId: string): string {
	const local = accountId.split('@')[0]?.trim()
	return local || accountId
}

/** Picks the best available label for an account. `override` comes from env config. */
export function resolveAccountDisplayName(identity: AccountIdentity | null, override?: string): string {
	if (override?.trim()) return override.trim()
	if (!identity) return ''

	const profileName = identity.profileName?.trim()
	if (profileName && profileName.toLowerCase() !== PLACEHOLDER_PROFILE_NAME) return profileName

	return displayNameFromAccountId(identity.accountId)
}

/**
 * Initials for the avatar fallback: "Ryan Andrew" → "RA".
 * A trailing number is kept whole, otherwise `…-demo-1` and `…-demo-10` would both
 * render "M1" — and on the demo the badge is the only thing telling them apart.
 */
export function initialsFromName(name: string): string {
	const words = name
		.trim()
		.split(/[\s._-]+/)
		.filter(Boolean)
	if (words.length === 0) return '?'
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

	const last = words[words.length - 1]
	const tail = /^\d+$/.test(last) ? last : last[0]
	return `${words[0][0]}${tail}`.toUpperCase()
}

async function fetchProfileName(
	subscriberUrl: string,
	token: string,
	profileId: string | null,
): Promise<string | null> {
	try {
		const res = await fetch(`${subscriberUrl.replace(/\/$/, '')}/v1/profiles`, {
			headers: { Authorization: authHeader(token) },
		})
		if (!res.ok) {
			console.warn('[accounts] Profile lookup failed, falling back to account id', {
				status: res.status,
				statusText: res.statusText,
			})
			return null
		}

		const profiles = (await res.json()) as SubscriberProfile[]
		if (!Array.isArray(profiles) || profiles.length === 0) {
			console.warn('[accounts] Profile lookup returned no profiles, falling back to account id', { profileId })
			return null
		}

		const match = profileId ? profiles.find((p) => p.Id === profileId) : null
		return (match ?? profiles[0]).Name?.trim() || null
	} catch (err) {
		console.warn('[accounts] Profile lookup threw, falling back to account id', { profileId, err })
		return null
	}
}

/**
 * Bootstraps a single account token to read its identity. Returns null when the
 * token is rejected — a dead account must not break the rest of the list.
 */
export async function fetchAccountIdentity(token: string): Promise<AccountIdentity | null> {
	const env = assertApiEnv()

	try {
		const bootstrap = await getBootstrap(env.mkApiHost, token, env.mkTenantId)
		const accountId = typeof bootstrap.AccountId === 'string' ? bootstrap.AccountId : ''
		if (!accountId) {
			console.warn('[accounts] Bootstrap returned no AccountId — is this a user token?', {
				profileIds: bootstrap.ProfileIds,
			})
			return null
		}

		const profileId = bootstrap.DefaultProfileId || null
		const subscriberUrl = devProxyUrl(bootstrap.ServiceMap.Services.subscriber)
		const profileName = await fetchProfileName(subscriberUrl, token, profileId)

		return { accountId, profileId, profileName }
	} catch (err) {
		console.warn('[accounts] Identity lookup failed for one account — it will render without a name', err)
		return null
	}
}
