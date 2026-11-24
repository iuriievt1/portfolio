import { useLayoutEffect } from "react"
import { sharedValue, useSharedValue } from "../../utils/shared-value"

const START = 1

const loadingScreens = sharedValue(START)
let isStartReleased = false

function changeLoadingScreens(by: number): void {
	loadingScreens.set(loadingScreens.get() + by)
}

export function useLoadingCover(isLoading: boolean): void {
	useLayoutEffect(() => {
		if (!isLoading) {
			return
		}
		changeLoadingScreens(1)
		return () => changeLoadingScreens(-1)
	}, [isLoading])
}

export function useStartCoverRelease(isStarted: boolean): void {
	useLayoutEffect(() => {
		if (!isStarted || isStartReleased) {
			return
		}
		isStartReleased = true
		changeLoadingScreens(-START)
	}, [isStarted])
}

export function useLoadingCovered(): boolean {
	return useSharedValue(loadingScreens) > 0
}
