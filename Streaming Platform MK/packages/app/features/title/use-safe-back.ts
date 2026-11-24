'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

function hasInternalHistory(): boolean {
	// Navigation API (Chrome 102+, Edge 102+) — most reliable
	const nav = (window as { navigation?: { currentEntry?: { index?: number } } }).navigation
	if (nav?.currentEntry != null && typeof nav.currentEntry.index === 'number') {
		return nav.currentEntry.index > 0
	}

	// Fallback: check if referrer is from the same origin (internal navigation)
	if (document.referrer) {
		try {
			return new URL(document.referrer).origin === window.location.origin
		} catch (err) {
			console.warn('[NAV] use-safe-back: unparseable referrer, treating as external', err)
			return false
		}
	}

	return false
}

/**
 * Returns a back handler that falls back to home when the page was opened
 * directly (no prior history within the app).
 */
export function useSafeBack() {
	const router = useRouter()

	return useCallback(() => {
		if (hasInternalHistory()) {
			router.back()
		} else {
			router.push('/')
		}
	}, [router])
}
