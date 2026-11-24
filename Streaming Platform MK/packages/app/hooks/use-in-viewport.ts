import { useEffect, useRef, useState } from 'react'

const DEFAULT_MARGIN = '400px'

/** Returns true once the observed element is within `rootMargin` of the viewport. One-shot. */
export function useInViewport(rootMargin = DEFAULT_MARGIN) {
	const ref = useRef<HTMLDivElement>(null)
	const [inView, setInView] = useState(false)

	useEffect(() => {
		if (inView) return
		const el = ref.current
		if (!el) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true)
					observer.disconnect()
				}
			},
			{ rootMargin },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [inView, rootMargin])

	return { ref, inView }
}
