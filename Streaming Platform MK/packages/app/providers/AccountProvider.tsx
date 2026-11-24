'use client'

import { getClientEnv } from '@pkg/utils/client-env'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchAccountIdentity, initialsFromName, resolveAccountDisplayName } from '../data/mk-api/accounts'
import { setActiveUserAccessToken } from '../data/mk-api/active-account'
import { getDataProvider } from '../data/provider'
import { ACCOUNT_IDENTITIES_QUERY_KEY, isSwitchScopedQuery } from './query-keys'

const STORAGE_KEY = 'mk-demo:active-account'

export { ACCOUNT_IDENTITIES_QUERY_KEY }

export type SwitchableAccount = {
	/** Stable positional id — never the token itself. */
	id: string
	name: string
	initials: string
	avatarUrl?: string
	/** MK username, once resolved. */
	accountId: string | null
	/** True when the identity lookup settled without a result — dead or expired token. */
	unresolved: boolean
}

type AccountContextValue = {
	accounts: SwitchableAccount[]
	activeAccountId: string | null
	/** Id of the account currently being switched to, or null when idle. */
	switchingAccountId: string | null
	switchAccount: (id: string) => void
	isLoading: boolean
}

const AccountContext = createContext<AccountContextValue>({
	accounts: [],
	activeAccountId: null,
	switchingAccountId: null,
	switchAccount: () => {},
	isLoading: false,
})

export const useAccounts = () => useContext(AccountContext)

const accountIdAt = (index: number) => `account-${index}`

function readStoredAccountId(): string | null {
	if (typeof window === 'undefined') return null
	try {
		return window.localStorage.getItem(STORAGE_KEY)
	} catch (err) {
		console.warn('[accounts] Cannot read stored selection, defaulting to the first account', err)
		return null
	}
}

function storeAccountId(id: string): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, id)
	} catch (err) {
		// Private-mode / disabled storage — selection just won't persist.
		console.warn('[accounts] Cannot persist selection, it will reset on reload', { id, err })
	}
}

function clearStoredAccountId(): void {
	try {
		window.localStorage.removeItem(STORAGE_KEY)
	} catch (err) {
		console.warn('[accounts] Cannot clear stored selection', err)
	}
}

export function AccountProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient()
	const configs = useMemo(() => getClientEnv().mkAccounts, [])

	// Restore the previous selection before any query runs, so the first boot
	// already uses the right token instead of fetching twice.
	const [activeAccountId, setActiveAccountId] = useState<string | null>(() => {
		if (configs.length === 0) return null

		const stored = readStoredAccountId()
		const storedIndex = configs.findIndex((_, i) => accountIdAt(i) === stored)
		const index = storedIndex >= 0 ? storedIndex : 0

		setActiveUserAccessToken(configs[index].token)
		return accountIdAt(index)
	})
	const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null)

	const identitiesEnabled = configs.length > 0 && getClientEnv().dataSource === 'api'
	const {
		data: identities,
		isLoading,
		isFetched,
	} = useQuery({
		queryKey: ACCOUNT_IDENTITIES_QUERY_KEY,
		queryFn: () => Promise.all(configs.map((config) => fetchAccountIdentity(config.token))),
		enabled: identitiesEnabled,
		staleTime: Number.POSITIVE_INFINITY,
		retry: 1,
	})

	// Once the lookup has settled, an account with no identity has a dead or expired
	// token. It still gets a label so the row is readable instead of a stuck skeleton —
	// picking it degrades to anonymous content, as the boot fallback already does.
	const identitiesSettled = identitiesEnabled && isFetched

	const accounts = useMemo<SwitchableAccount[]>(
		() =>
			configs.map((config, index) => {
				const identity = identities?.[index] ?? null
				// Keyed off the identity, not the label: a configured `name` override still
				// renders for a dead token, so it cannot stand in for a successful lookup.
				const unresolved = identitiesSettled && !identity
				const resolved = resolveAccountDisplayName(identity, config.name)
				const name = resolved || (unresolved ? `Account ${index + 1}` : '')

				if (unresolved) {
					console.warn('[accounts] No identity for this account — token is likely expired or invalid', {
						id: accountIdAt(index),
						fallbackLabel: name,
					})
				}

				return {
					id: accountIdAt(index),
					name,
					initials: name ? initialsFromName(name) : '',
					avatarUrl: config.avatarUrl,
					accountId: identity?.accountId ?? null,
					unresolved,
				}
			}),
		[configs, identities, identitiesSettled],
	)

	const switchAccount = useCallback(
		(id: string) => {
			if (id === activeAccountId || switchingAccountId) return

			const index = configs.findIndex((_, i) => accountIdAt(i) === id)
			if (index < 0) return

			setSwitchingAccountId(id)
			setActiveUserAccessToken(configs[index].token)
			storeAccountId(id)
			;(async () => {
				try {
					const provider = await getDataProvider()
					provider.resetCaches()
					// Neither switcher's own list is account-scoped; everything else must refetch.
					await queryClient.resetQueries({ predicate: (query) => isSwitchScopedQuery(query.queryKey) })
					setActiveAccountId(id)
				} catch (err) {
					console.warn('[accounts] Switch failed, reverting', err)
					const previous = configs.findIndex((_, i) => accountIdAt(i) === activeAccountId)
					setActiveUserAccessToken(previous >= 0 ? configs[previous].token : null)
					// Storage was written optimistically — roll it back so a reload does not
					// silently resume on the selection that just failed.
					if (activeAccountId) storeAccountId(activeAccountId)
					else clearStoredAccountId()
				} finally {
					setSwitchingAccountId(null)
				}
			})()
		},
		[activeAccountId, configs, queryClient, switchingAccountId],
	)

	// Keep the token override alive across fast-refresh / remounts.
	useEffect(() => {
		const index = configs.findIndex((_, i) => accountIdAt(i) === activeAccountId)
		if (index >= 0) setActiveUserAccessToken(configs[index].token)
	}, [activeAccountId, configs])

	const value = useMemo<AccountContextValue>(
		() => ({ accounts, activeAccountId, switchingAccountId, switchAccount, isLoading }),
		[accounts, activeAccountId, switchingAccountId, switchAccount, isLoading],
	)

	return <AccountContext value={value}>{children}</AccountContext>
}
