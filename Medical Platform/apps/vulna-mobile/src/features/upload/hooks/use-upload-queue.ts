import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { catchUpUploads, startUploadQueue } from "../upload-queue"

const ACTIVE_APP: AppStateStatus = "active"

// NAB-205, NAB-208, CAP-019-R02, CAP-019-R04, CAP-019-R24, CAP-015-R30
export function useUploadQueue(enabled: boolean): void {
	useEffect(() => {
		if (enabled) {
			startUploadQueue()
		}
	}, [enabled])

	useEffect(() => {
		if (!enabled) {
			return
		}
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === ACTIVE_APP) {
				catchUpUploads()
			}
		})
		return () => subscription.remove()
	}, [enabled])
}
