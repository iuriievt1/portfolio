'use client'

import { useEffect, useState } from 'react'
import { BREAKPOINTS } from '../../../tokens/breakpoints'

/** Width the expanded search would like at this viewport, before the bar's own space is taken into account. */
export function usePreferredPillWidth() {
	const [width, setWidth] = useState(240)
	useEffect(() => {
		function update() {
			const vw = window.innerWidth
			if (vw >= BREAKPOINTS.xl) setWidth(280)
			else if (vw >= BREAKPOINTS.lg) setWidth(260)
			else setWidth(240)
		}
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])
	return width
}
