import { useCallback, useState } from "react"
import { type CaptureFailure, captureFailureOf, remoteCaptureFailureOf } from "../../capture/capture-failure"
import { captureSessionOf } from "../../capture/capture-session"
import { type PhotoOwner, reorderCapturedPhotos } from "../../capture/photo-buffer"
import { orderFilesOnServer } from "../../upload/file-changes"

interface PageOrder {
	failure: CaptureFailure | undefined
	reorder: (fileKeys: readonly string[]) => void
	dismissFailure: () => void
}

// CAP-018-R11, CAP-018-S10, CAP-021-R32
export function usePageOrder(owner: PhotoOwner | undefined): PageOrder {
	const [failure, setFailure] = useState<CaptureFailure | undefined>(undefined)

	const reorder = useCallback(
		(fileKeys: readonly string[]) => {
			if (owner === undefined) {
				return
			}
			const before = captureSessionOf(owner.acquisitionId).photos.map((page) => page.fileKey)
			const move = async () => {
				await reorderCapturedPhotos(owner, fileKeys)
				try {
					await orderFilesOnServer(owner.acquisitionId, fileKeys)
				} catch (error) {
					await reorderCapturedPhotos(owner, before)
					setFailure(remoteCaptureFailureOf(error))
				}
			}
			move().catch((error: unknown) => setFailure(captureFailureOf(error)))
		},
		[owner],
	)

	const dismissFailure = useCallback(() => setFailure(undefined), [])

	return { failure, reorder, dismissFailure }
}
