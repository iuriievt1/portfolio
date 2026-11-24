import { useCallback, useRef } from 'react'

/**
 * Manages an auto-hide idle timer for player controls.
 * Returns `startTimer` (resets + starts countdown) and `clearTimer` (cancels).
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void) {
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = undefined
		}
	}, [])

	const startTimer = useCallback(() => {
		clearTimer()
		timerRef.current = setTimeout(onIdle, timeoutMs)
	}, [clearTimer, onIdle, timeoutMs])

	return { startTimer, clearTimer }
}
