import { useCallback, useEffect, useRef, useState } from "react"
import { BACKGROUND_REFRESH_INIT } from "@/api/client"

interface CursorPage<T> {
	items?: T[]
	next_cursor?: string | null
}

export interface CursorList<T> {
	items: T[]
	error: unknown
	loading: boolean
	hasMore: boolean
	more: () => void
	retry: () => void
	refresh: () => Promise<void>
}

type PageLoader<T> = (cursor: string | undefined, init?: RequestInit) => Promise<CursorPage<T>>

// ADR-012
export function useCursorList<T>(loadPage: PageLoader<T>): CursorList<T> {
	const [items, setItems] = useState<T[]>([])
	const [nextCursor, setNextCursor] = useState<string | null>(null)
	const [error, setError] = useState<unknown>(undefined)
	const [loading, setLoading] = useState(true)
	const listing = useRef(0)
	const revision = useRef(0)
	const lastCursor = useRef<string | undefined>(undefined)
	const shownCount = useRef(0)
	const loadsInFlight = useRef(0)
	const hasReloadFailed = useRef(false)

	const load = useCallback(
		async (cursor: string | undefined) => {
			const current = listing.current
			revision.current += 1
			lastCursor.current = cursor
			loadsInFlight.current += 1
			hasReloadFailed.current = false
			setLoading(true)
			setError(undefined)
			try {
				const page = await loadPage(cursor)
				if (current !== listing.current) {
					return
				}
				setItems((shown) => {
					const next = cursor === undefined ? (page.items ?? []) : [...shown, ...(page.items ?? [])]
					shownCount.current = next.length
					return next
				})
				setNextCursor(page.next_cursor ?? null)
			} catch (reason) {
				if (current === listing.current) {
					setError(reason)
				}
			} finally {
				loadsInFlight.current -= 1
				if (current === listing.current) {
					setLoading(false)
				}
			}
		},
		[loadPage],
	)

	useEffect(() => {
		listing.current += 1
		void load(undefined)
	}, [load])

	const more = useCallback(() => {
		if (nextCursor !== null) {
			void load(nextCursor)
		}
	}, [load, nextCursor])

	// CAP-028-R14
	const reloadShown = useCallback(
		async (init: RequestInit | undefined) => {
			if (loadsInFlight.current > 0) {
				return
			}
			const current = listing.current
			const started = revision.current
			const isCurrent = () => current === listing.current && started === revision.current
			const collected: T[] = []
			let cursor: string | undefined
			let next: string | null = null
			try {
				do {
					const page = await loadPage(cursor, init)
					collected.push(...(page.items ?? []))
					next = page.next_cursor ?? null
					cursor = next ?? undefined
				} while (next !== null && collected.length < shownCount.current && isCurrent())
				if (isCurrent()) {
					lastCursor.current = undefined
					hasReloadFailed.current = false
					shownCount.current = collected.length
					setItems(collected)
					setNextCursor(next)
					setError(undefined)
				}
			} catch (reason) {
				if (isCurrent()) {
					hasReloadFailed.current = true
					setError(reason)
				}
			}
		},
		[loadPage],
	)

	const retry = useCallback(() => {
		if (hasReloadFailed.current) {
			void reloadShown(undefined)
			return
		}
		void load(lastCursor.current)
	}, [load, reloadShown])

	const refresh = useCallback(() => reloadShown(BACKGROUND_REFRESH_INIT), [reloadShown])

	return { items, error, loading, hasMore: nextCursor !== null, more, retry, refresh }
}
