'use client'

import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Breakpoints & media queries
// ---------------------------------------------------------------------------

/** Breakpoint where hamburger menu replaces inline nav items */
export const NAV_BREAKPOINT = 450

/** Below this width, search hides nav items and avatar */
export const NARROW_BREAKPOINT = 650

export const NARROW_MQ = `(max-width: ${NARROW_BREAKPOINT - 1}px)`

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const BLUR_TRANSITION = { duration: 0.3, ease: EASE_OUT_EXPO } as const

// ---------------------------------------------------------------------------
// Glass material tokens
// ---------------------------------------------------------------------------

export const GLASS_MATERIAL = {
	backgroundColor: 'rgba(8, 15, 35, 0.85)',
	backdropFilter: 'blur(24px)',
	border: '1px solid rgba(255, 255, 255, 0.06)',
	boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
} as const

export const SCRIM_STYLE = {
	backgroundColor: 'rgba(0,0,0,0.25)',
	backdropFilter: 'blur(8px) saturate(140%)',
} as const

export const GLASS_RADIUS = 14

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia(query)
		setMatches(mq.matches)
		const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [query])
	return matches
}
