import { useCallback, useEffect, useRef, useState } from "react"

export interface RequestState<T> {
	data: T | undefined
	error: unknown
	loading: boolean
	reload: () => void
}

export function useRequest<T>(load: () => Promise<T>): RequestState<T> {
	const [data, setData] = useState<T | undefined>(undefined)
	const [error, setError] = useState<unknown>(undefined)
	const [loading, setLoading] = useState(true)
	const generation = useRef(0)

	const run = useCallback(() => {
		generation.current += 1
		const current = generation.current
		setLoading(true)
		setError(undefined)
		load()
			.then((loaded) => {
				if (current === generation.current) {
					setData(loaded)
				}
			})
			.catch((reason: unknown) => {
				if (current === generation.current) {
					setError(reason)
				}
			})
			.finally(() => {
				if (current === generation.current) {
					setLoading(false)
				}
			})
	}, [load])

	useEffect(() => {
		run()
		return () => {
			generation.current += 1
		}
	}, [run])

	return { data, error, loading, reload: run }
}
