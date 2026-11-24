import { useCallback, useEffect, useRef, useState } from "react"
import { BACKGROUND_REFRESH_INIT } from "@/api/client"
import { useLiveRefresh } from "@/lib/live-refresh"

export interface LiveRequest<T> {
	data: T | undefined
	error: unknown
	reload: () => void
}

// CAP-028-R14, NAB-534, CAP-004-R11
export function useLiveRequest<T>(load: (init: RequestInit | undefined) => Promise<T>): LiveRequest<T> {
	const [data, setData] = useState<T | undefined>(undefined)
	const [error, setError] = useState<unknown>(undefined)
	const generation = useRef(0)

	const run = useCallback(
		(init: RequestInit | undefined): Promise<void> => {
			generation.current += 1
			const current = generation.current
			return load(init)
				.then((loaded) => {
					if (current === generation.current) {
						setData(loaded)
						setError(undefined)
					}
				})
				.catch((reason: unknown) => {
					if (current === generation.current) {
						setError(reason)
					}
				})
		},
		[load],
	)

	useEffect(() => {
		void run(undefined)
		return () => {
			generation.current += 1
		}
	}, [run])

	const reload = useCallback(() => {
		setError(undefined)
		void run(undefined)
	}, [run])
	const refresh = useCallback(() => run(BACKGROUND_REFRESH_INIT), [run])
	useLiveRefresh(refresh)

	return { data, error, reload }
}
