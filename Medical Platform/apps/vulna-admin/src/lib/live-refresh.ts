import { useEffect } from "react"
import cs from "@/i18n/cs.json"

const MILLISECONDS_PER_SECOND = 1000
const VISIBLE: DocumentVisibilityState = "visible"
const VISIBILITY_CHANGE = "visibilitychange"

// CAP-028-R14, NAB-534
export const LIVE_REFRESH_SECONDS = 2

// CAP-004-R11
export const SESSION_CHECK_SECONDS = 30

export interface ShownPage {
	readonly visibilityState: DocumentVisibilityState
	addEventListener(type: typeof VISIBILITY_CHANGE, listener: () => void): void
	removeEventListener(type: typeof VISIBILITY_CHANGE, listener: () => void): void
}

type Refresh = () => unknown

// CAP-028-R14, NAB-534
export function startLiveRefresh(refresh: Refresh, page: ShownPage, seconds: number): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined
	let isRefreshing = false
	let isStopped = false

	function scheduleNext() {
		clearTimeout(timer)
		if (!isStopped) {
			timer = setTimeout(refreshWhileShown, seconds * MILLISECONDS_PER_SECOND)
		}
	}

	function refreshWhileShown() {
		if (isRefreshing || isStopped || page.visibilityState !== VISIBLE) {
			return
		}
		isRefreshing = true
		Promise.resolve()
			.then(() => refresh())
			.catch((error: unknown) => console.warn("the live refresh failed", error))
			.finally(() => {
				isRefreshing = false
				scheduleNext()
			})
	}

	scheduleNext()
	page.addEventListener(VISIBILITY_CHANGE, refreshWhileShown)
	return () => {
		isStopped = true
		clearTimeout(timer)
		page.removeEventListener(VISIBILITY_CHANGE, refreshWhileShown)
	}
}

// CAP-028-R14, NAB-534
export function useLiveRefresh(refresh: Refresh, seconds: number = LIVE_REFRESH_SECONDS, isEnabled = true): void {
	useEffect(() => {
		if (!isEnabled) {
			return
		}
		return startLiveRefresh(refresh, document, seconds)
	}, [refresh, seconds, isEnabled])
}

export function liveRefreshText(): string {
	return cs.common.liveRefresh
}
