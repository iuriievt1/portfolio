'use client'

import { getClientEnv } from '@pkg/utils/client-env'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { setActiveStoreId } from '../data/mk-api/active-store'
import { fetchStores, type StoreOption } from '../data/mk-api/stores'
import { getDataProvider } from '../data/provider'
import { isSwitchScopedQuery, STORES_QUERY_KEY } from './query-keys'

/**
 * Session-scoped on purpose: MK asked for the demo to default back to the
 * configured store on a fresh session, so a stale store never surprises a
 * salesperson opening a new tab.
 */
const STORAGE_KEY = 'mk-demo:active-store'

export { STORES_QUERY_KEY }

type StoreContextValue = {
	stores: StoreOption[]
	activeStoreId: string | null
	switchingStoreId: string | null
	switchStore: (id: string) => void
	isLoading: boolean
}

const StoreContext = createContext<StoreContextValue>({
	stores: [],
	activeStoreId: null,
	switchingStoreId: null,
	switchStore: () => {},
	isLoading: false,
})

export const useStores = () => useContext(StoreContext)

function readStoredStoreId(): string | null {
	if (typeof window === 'undefined') return null
	try {
		return window.sessionStorage.getItem(STORAGE_KEY)
	} catch (err) {
		console.warn('[stores] Cannot read stored store, defaulting to the configured one', err)
		return null
	}
}

function storeStoreId(id: string): void {
	try {
		window.sessionStorage.setItem(STORAGE_KEY, id)
	} catch (err) {
		console.warn('[stores] Cannot persist store selection, it will reset on reload', { id, err })
	}
}

function clearStoredStoreId(): void {
	try {
		window.sessionStorage.removeItem(STORAGE_KEY)
	} catch (err) {
		console.warn('[stores] Cannot clear stored store selection', err)
	}
}

export function StoreProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient()
	const router = useRouter()
	const env = useMemo(() => getClientEnv(), [])
	const defaultStoreId = env.mkStoreId

	// Restore before any query runs, so the first boot already targets the right store.
	const [activeStoreId, setActiveStoreIdState] = useState<string | null>(() => {
		const stored = readStoredStoreId()
		const initial = stored || defaultStoreId || null
		if (initial) setActiveStoreId(initial)
		return initial
	})
	const [switchingStoreId, setSwitchingStoreId] = useState<string | null>(null)

	// Read inside the async switch to tell "user navigated" from "still where they were".
	const pathname = usePathname()
	const pathnameRef = useRef(pathname)
	useEffect(() => {
		pathnameRef.current = pathname
	}, [pathname])

	const storesEnabled = env.dataSource === 'api' && Boolean(env.mkApiHost)
	const { data: stores, isLoading } = useQuery({
		queryKey: STORES_QUERY_KEY,
		queryFn: fetchStores,
		enabled: storesEnabled,
		staleTime: Number.POSITIVE_INFINITY,
		retry: 1,
	})

	const switchStore = useCallback(
		(id: string) => {
			// Spans applying the store and navigating — enough to stop a double-click.
			if (id === activeStoreId || switchingStoreId) return

			// Ignore ids that are not in the fetched list — a store can disappear between
			// render and click, and booting against a dead store id breaks the whole app.
			if (stores && !stores.some((store) => store.id === id)) {
				console.warn('[stores] Ignoring switch to an unknown store id', { id })
				return
			}

			const pathnameAtStart = pathnameRef.current
			setSwitchingStoreId(id)
			setActiveStoreId(id)
			storeStoreId(id)
			;(async () => {
				try {
					const provider = await getDataProvider()
					// Drops the booted session — every fetch from here re-boots against the new store.
					provider.resetCaches()
					setActiveStoreIdState(id)
					// Hubs differ per store, so the current route may not exist in the new one.
					// Skip it if the user navigated themselves while the switch was in flight.
					if (pathnameRef.current === pathnameAtStart) router.push('/')
					else console.warn('[stores] User navigated during the switch, keeping their route')
					// Not awaited — waiting for every rail held the panel inert. Store-scoped
					// queries go; the account survives, it is valid across the tenant's stores.
					void queryClient
						.resetQueries({ predicate: (query) => isSwitchScopedQuery(query.queryKey) })
						.catch((err) => console.error('[stores] Refetch after the store switch failed', { id, err }))
				} catch (err) {
					console.error('[stores] Store switch failed, reverting to the previous store', { id, err })
					setActiveStoreId(activeStoreId)
					// Storage was written optimistically — roll it back so a reload does not
					// silently resume on the store that just failed.
					if (activeStoreId) storeStoreId(activeStoreId)
					else clearStoredStoreId()
				} finally {
					setSwitchingStoreId(null)
				}
			})()
		},
		[activeStoreId, switchingStoreId, stores, queryClient, router],
	)

	// Keep the override alive across fast-refresh / remounts.
	useEffect(() => {
		if (activeStoreId) setActiveStoreId(activeStoreId)
	}, [activeStoreId])

	// Figma numbers the configured demo store #1, so it leads the list. Sorted by the
	// configured default rather than the active store, otherwise the numbers would
	// reshuffle every time someone switches.
	const orderedStores = useMemo(() => {
		if (!stores) return []
		return [...stores].sort((a, b) => Number(b.id === defaultStoreId) - Number(a.id === defaultStoreId))
	}, [stores, defaultStoreId])

	const value = useMemo<StoreContextValue>(
		() => ({ stores: orderedStores, activeStoreId, switchingStoreId, switchStore, isLoading }),
		[orderedStores, activeStoreId, switchingStoreId, switchStore, isLoading],
	)

	return <StoreContext value={value}>{children}</StoreContext>
}
