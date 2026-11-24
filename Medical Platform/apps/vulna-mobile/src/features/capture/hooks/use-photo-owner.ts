import { useEffect, useMemo } from "react"
import { currentSession } from "../../session/session-store"
import { captureSessionOf } from "../capture-session"
import { loadCapturedPhotos, type PhotoOwner } from "../photo-buffer"

// CAP-015-R17, CAP-015-S04
export function usePhotoOwner(acquisitionId: string): PhotoOwner | undefined {
	const operatorUserId = currentSession()?.user.id
	const owner = useMemo(
		() => (operatorUserId === undefined ? undefined : { acquisitionId, operatorUserId }),
		[acquisitionId, operatorUserId],
	)

	useEffect(() => {
		if (owner === undefined || captureSessionOf(owner.acquisitionId).isSeriesLoaded) {
			return
		}
		loadCapturedPhotos(owner).catch((failure: unknown) =>
			console.warn("the photos of the record could not be read", failure),
		)
	}, [owner])

	return owner
}
