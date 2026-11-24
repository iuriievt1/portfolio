import { useEffect, useRef } from "react"
import { AppState, type AppStateStatus } from "react-native"

const BACKGROUND: AppStateStatus = "background"
const ACTIVE: AppStateStatus = "active"

export interface AppReturnHandlers {
	onHide?: () => void
	onReturn: (awayMilliseconds: number) => void
}

export function useAppReturn(handlers: AppReturnHandlers, enabled = true): void {
	const latest = useRef(handlers)
	const hiddenAt = useRef<number | undefined>(undefined)

	useEffect(() => {
		latest.current = handlers
	})

	useEffect(() => {
		if (!enabled) {
			return
		}
		const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === BACKGROUND) {
				hiddenAt.current = Date.now()
				latest.current.onHide?.()
				return
			}
			if (state !== ACTIVE || hiddenAt.current === undefined) {
				return
			}
			const away = Date.now() - hiddenAt.current
			hiddenAt.current = undefined
			latest.current.onReturn(away)
		})
		return () => subscription.remove()
	}, [enabled])
}
