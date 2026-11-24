import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { type CameraErrorReport, cameraErrorHandlerOf } from "../camera-lifecycle"

const ACTIVE_APP: AppStateStatus = "active"
const FIRST_SESSION = 0

export interface CameraLifecycle {
	isActive: boolean
	sessionKey: number
	onError: CameraErrorReport
	restart: () => void
}

function isAppActiveNow(): boolean {
	return AppState.currentState === ACTIVE_APP
}

// CAP-015-R10, CAP-013-R02, E130
export function useCameraLifecycle(isWanted: boolean, onFailure: () => void): CameraLifecycle {
	const [isAppActive, setAppActive] = useState(isAppActiveNow)
	const [sessionKey, setSessionKey] = useState(FIRST_SESSION)
	const latestFailure = useRef(onFailure)

	useEffect(() => {
		latestFailure.current = onFailure
	})

	useEffect(() => {
		setAppActive(isAppActiveNow())
		const subscription = AppState.addEventListener("change", (state) => setAppActive(state === ACTIVE_APP))
		return () => subscription.remove()
	}, [])

	const onError = useMemo(
		() =>
			cameraErrorHandlerOf(isAppActiveNow, (error) => {
				console.warn("the camera stopped", error)
				latestFailure.current()
			}),
		[],
	)
	const restart = useCallback(() => setSessionKey((key) => key + 1), [])

	return { isActive: isWanted && isAppActive, sessionKey, onError, restart }
}
