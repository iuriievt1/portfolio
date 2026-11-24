import { useCallback, useEffect, useRef, useState } from 'react'

type UseHeroCarouselOptions = {
	count: number
	autoPlayMs?: number
	paused?: boolean
}

export function useHeroCarousel({ count, autoPlayMs = 5000, paused }: UseHeroCarouselOptions) {
	const [active, setActive] = useState(0)
	const [progressKey, setProgressKey] = useState(0)
	const dirRef = useRef<1 | -1>(1)
	const activeRef = useRef(0)
	activeRef.current = active

	const goTo = useCallback(
		(idx: number) => {
			const current = activeRef.current
			dirRef.current = idx >= current ? 1 : -1
			const next = ((idx % count) + count) % count
			setActive(next)
			setProgressKey((k) => k + 1)
		},
		[count],
	)

	useEffect(() => {
		if (count <= 1 || paused) return
		const id = setInterval(() => {
			setActive((prev) => {
				const next = (prev + 1) % count
				dirRef.current = 1
				return next
			})
			setProgressKey((k) => k + 1)
		}, autoPlayMs)
		return () => clearInterval(id)
	}, [count, autoPlayMs, paused])

	return {
		active,
		progressKey,
		direction: dirRef.current,
		goTo,
	}
}
