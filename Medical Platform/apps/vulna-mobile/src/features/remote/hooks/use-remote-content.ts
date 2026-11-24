import { NoSessionError } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"

export const LOAD_STATE = {
	LOADING: "loading",
	READY: "ready",
	FAILED: "failed",
} as const

export type LoadState<Content extends object> =
	| { kind: typeof LOAD_STATE.LOADING }
	| ({ kind: typeof LOAD_STATE.READY } & Content)
	| { kind: typeof LOAD_STATE.FAILED; failure: RemoteFailure }

// CAP-020-R02, CAP-025-R28
export const REFRESH = {
	ON_FOCUS: "on_focus",
	ONCE: "once",
} as const

type Refresh = (typeof REFRESH)[keyof typeof REFRESH]

export type FailureOf = (error: unknown) => RemoteFailure

export interface RemoteContentOptions {
	failureOf?: FailureOf
	refresh?: Refresh
}

export const LOADING = { kind: LOAD_STATE.LOADING } as const

// CAP-002-R17
export function useRemoteContent<Content extends object>(
	read: () => Promise<Content>,
	{ failureOf = remoteFailureOf, refresh = REFRESH.ON_FOCUS }: RemoteContentOptions = {},
) {
	const [state, setState] = useState<LoadState<Content>>(LOADING)

	const load = useCallback(async () => {
		try {
			const content = await read()
			setState({ kind: LOAD_STATE.READY, ...content })
		} catch (error) {
			if (error instanceof NoSessionError) {
				return
			}
			setState({ kind: LOAD_STATE.FAILED, failure: failureOf(error) })
		}
	}, [read, failureOf])

	useFocusEffect(
		useCallback(() => {
			if (refresh === REFRESH.ON_FOCUS) {
				void load()
			}
		}, [load, refresh]),
	)

	useEffect(() => {
		if (refresh === REFRESH.ONCE) {
			void load()
		}
	}, [load, refresh])

	const retry = useCallback(() => {
		setState(LOADING)
		void load()
	}, [load])

	const reload = useCallback(() => {
		void load()
	}, [load])

	const update = useCallback((change: Partial<Content>) => {
		setState((current) => (current.kind === LOAD_STATE.READY ? { ...current, ...change } : current))
	}, [])

	return { state, retry, reload, update }
}
