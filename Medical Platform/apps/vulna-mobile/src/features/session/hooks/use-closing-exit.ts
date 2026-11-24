import { useRouter } from "expo-router"
import { useCallback, useEffect } from "react"
import { ROUTE } from "../../../navigation/routes"
import { useAppVersionRejected } from "../../app-version/app-version-store"
import { resumeSignOutAfterClosing, stopAwaitingClosing } from "../sign-out-resume"

// CAP-015-S09, CAP-012-R25
export function useClosingExit(acquisitionId: string, close: () => void): () => void {
	const router = useRouter()
	const isAppOutdated = useAppVersionRejected()

	useEffect(() => () => stopAwaitingClosing(acquisitionId), [acquisitionId])

	return useCallback(() => {
		if (!resumeSignOutAfterClosing(acquisitionId)) {
			close()
			return
		}
		if (isAppOutdated) {
			router.dismissTo(ROUTE.HOME)
			return
		}
		router.replace(ROUTE.SETTINGS)
	}, [acquisitionId, close, isAppOutdated, router])
}
