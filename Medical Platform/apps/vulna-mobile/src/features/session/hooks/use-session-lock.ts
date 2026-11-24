import { useRouter } from "expo-router"
import { useCallback, useEffect, useRef } from "react"
import { ROUTE } from "../../../navigation/routes"
import { millisecondsOf } from "../../../utils/time"
import { lockApp } from "../session-actions"
import { currentSession, useSessionClosure } from "../session-store"
import { useAppReturn } from "./use-app-return"

const DEFAULT_INACTIVITY_LOCK_SECONDS = 300

function lockAfterMilliseconds(): number {
	return millisecondsOf(currentSession()?.inactivity_lock_seconds ?? DEFAULT_INACTIVITY_LOCK_SECONDS)
}

export function useSessionLock(): { touched: () => void; lock: () => void } {
	const router = useRouter()
	const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const end = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const closed = useSessionClosure() !== undefined

	const stopTimers = useCallback(() => {
		clearTimeout(idle.current)
		clearTimeout(end.current)
	}, [])

	const lock = useCallback(() => {
		stopTimers()
		if (currentSession() === undefined) {
			return
		}
		lockApp()
		router.replace(ROUTE.UNLOCK)
	}, [router, stopTimers])

	useEffect(() => {
		if (!closed) {
			return
		}
		stopTimers()
		router.replace(ROUTE.UNLOCK)
	}, [closed, router, stopTimers])

	const touched = useCallback(() => {
		clearTimeout(idle.current)
		if (currentSession() === undefined) {
			return
		}
		idle.current = setTimeout(lock, lockAfterMilliseconds())
	}, [lock])

	useAppReturn({
		onReturn: (away) => {
			if (away >= lockAfterMilliseconds()) {
				lock()
				return
			}
			touched()
		},
	})

	useEffect(() => {
		touched()
		const session = currentSession()
		if (session !== undefined) {
			const untilEnd = new Date(session.session_end).getTime() - Date.now()
			end.current = setTimeout(lock, Math.max(0, untilEnd))
		}
		return stopTimers
	}, [lock, touched, stopTimers])

	return { touched, lock }
}
