import { NoSessionError } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import type { LoadedPage } from "../../../api/pages"
import { remoteFailureOf } from "../../../api/remote-failure"
import { LOAD_STATE, LOADING, type LoadState, REFRESH, type RemoteContentOptions } from "./use-remote-content"

export const MORE = {
	AVAILABLE: "available",
	LOADING: "loading",
	FAILED: "failed",
	NONE: "none",
} as const

export type More = (typeof MORE)[keyof typeof MORE]

export const MORE_THRESHOLD = 0.5

export type PagedContent<Item, Content extends object> = Content & {
	items: readonly Item[]
	more: More
}

function moreAfter(nextCursor: string | undefined): More {
	return nextCursor === undefined ? MORE.NONE : MORE.AVAILABLE
}

// ADR-012, CAP-002-R17, CAP-020-R02
export function usePagedContent<Item, Content extends object>(
	readFirst: () => Promise<LoadedPage<Item> & Content>,
	readNext: (cursor: string) => Promise<LoadedPage<Item>>,
	{ failureOf = remoteFailureOf, refresh = REFRESH.ONCE }: RemoteContentOptions = {},
) {
	const [state, setState] = useState<LoadState<PagedContent<Item, Content>>>(LOADING)
	const cursor = useRef<string | undefined>(undefined)
	const isReadingMore = useRef(false)
	const generation = useRef(0)
	const wasFocused = useRef(false)

	const showMore = useCallback((more: More) => {
		setState((current) => (current.kind === LOAD_STATE.READY ? { ...current, more } : current))
	}, [])

	const load = useCallback(async () => {
		generation.current += 1
		const loading = generation.current
		try {
			const { items, nextCursor, ...content } = await readFirst()
			if (loading !== generation.current) {
				return
			}
			cursor.current = nextCursor
			setState({ kind: LOAD_STATE.READY, ...(content as Content), items, more: moreAfter(nextCursor) })
		} catch (error) {
			if (loading !== generation.current || error instanceof NoSessionError) {
				return
			}
			setState({ kind: LOAD_STATE.FAILED, failure: failureOf(error) })
		}
	}, [readFirst, failureOf])

	useEffect(() => {
		void load()
	}, [load])

	useFocusEffect(
		useCallback(() => {
			if (refresh === REFRESH.ON_FOCUS && wasFocused.current) {
				void load()
			}
			wasFocused.current = true
		}, [load, refresh]),
	)

	const loadMore = useCallback(async () => {
		const next = cursor.current
		if (next === undefined || isReadingMore.current) {
			return
		}
		isReadingMore.current = true
		const loading = generation.current
		showMore(MORE.LOADING)
		try {
			const page = await readNext(next)
			if (loading !== generation.current) {
				return
			}
			cursor.current = page.nextCursor
			setState((current) =>
				current.kind === LOAD_STATE.READY
					? { ...current, items: [...current.items, ...page.items], more: moreAfter(page.nextCursor) }
					: current,
			)
		} catch (error) {
			if (loading === generation.current && !(error instanceof NoSessionError)) {
				showMore(MORE.FAILED)
			}
		} finally {
			isReadingMore.current = false
		}
	}, [readNext, showMore])

	const retry = useCallback(() => {
		setState(LOADING)
		void load()
	}, [load])

	const reload = useCallback(() => {
		void load()
	}, [load])

	return { state, retry, reload, loadMore }
}
