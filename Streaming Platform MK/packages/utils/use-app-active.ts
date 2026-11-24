import { useEffect, useState } from 'react'

/** react-native is absent on web by design, and this hook runs on every mount — log the first miss only. */
let appStateUnavailableLogged = false

/**
 * Returns `true` when the app is in the foreground (active state).
 *
 * In non-React-Native environments (web, tests), always returns `true`.
 *
 * Usage:
 * ```ts
 * const isActive = useAppActive()
 * const carousel = useHeroCarousel({ count, paused: !isActive })
 * ```
 */
export function useAppActive(): boolean {
	const [isActive, setIsActive] = useState(true)

	useEffect(() => {
		let subscription: { remove: () => void } | undefined

		try {
			// Dynamic require so this module can be imported in jsdom/web environments
			// where react-native is not available.
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { AppState } = require('react-native')

			setIsActive(AppState.currentState === 'active')

			subscription = AppState.addEventListener('change', (state: string) => {
				setIsActive(state === 'active')
			})
		} catch (err) {
			// Expected on web/test where react-native is absent — stay active. Logged once
			// because this fires on every web mount and is not a fault.
			if (!appStateUnavailableLogged) {
				appStateUnavailableLogged = true
				console.warn('[useAppActive] react-native AppState unavailable, assuming always active (logged once)', err)
			}
		}

		return () => {
			subscription?.remove()
		}
	}, [])

	return isActive
}
