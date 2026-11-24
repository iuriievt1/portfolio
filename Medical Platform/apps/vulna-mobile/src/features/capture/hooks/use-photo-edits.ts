import type { BufferedFile, PhotoCrop } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { removeFileOnServer } from "../../upload/file-changes"
import { type CaptureFailure, captureFailureOf, remoteCaptureFailureOf } from "../capture-failure"
import { cropCapturedPhoto, forgetCapturedPhoto, rotateCapturedPhoto } from "../photo-buffer"

type FailureOf = (error: unknown) => CaptureFailure

interface PhotoEdits {
	isBusy: boolean
	failure: CaptureFailure | undefined
	remove: (photo: BufferedFile) => Promise<boolean>
	removeOnServer: (fileKey: string) => Promise<boolean>
	rotate: (photo: BufferedFile) => Promise<boolean>
	crop: (photo: BufferedFile, crop: PhotoCrop) => Promise<boolean>
	dismissFailure: () => void
}

// CAP-015-R18, CAP-015-R34
export function usePhotoEdits(acquisitionId: string): PhotoEdits {
	const [isBusy, setBusy] = useState(false)
	const [failure, setFailure] = useState<CaptureFailure | undefined>(undefined)
	const busy = useRef(false)

	const run = useCallback(async (edit: () => Promise<void>, failureOf: FailureOf): Promise<boolean> => {
		if (busy.current) {
			return false
		}
		busy.current = true
		setBusy(true)
		try {
			await edit()
			return true
		} catch (error) {
			setFailure(failureOf(error))
			return false
		} finally {
			busy.current = false
			setBusy(false)
		}
	}, [])

	// CAP-015-R18, CAP-015-R36, CAP-015-S51, Q-076
	const removeOnServer = useCallback(
		(fileKey: string) => run(() => removeFileOnServer(acquisitionId, fileKey), remoteCaptureFailureOf),
		[run, acquisitionId],
	)
	// CAP-015-R18, CAP-002-R17
	const remove = useCallback(
		async (photo: BufferedFile) =>
			(await removeOnServer(photo.fileKey)) &&
			(await run(() => forgetCapturedPhoto(acquisitionId, photo), captureFailureOf)),
		[run, removeOnServer, acquisitionId],
	)
	const rotate = useCallback(
		(photo: BufferedFile) => run(() => rotateCapturedPhoto(acquisitionId, photo), captureFailureOf),
		[run, acquisitionId],
	)
	const crop = useCallback(
		(photo: BufferedFile, rectangle: PhotoCrop) =>
			run(() => cropCapturedPhoto(acquisitionId, photo, rectangle), captureFailureOf),
		[run, acquisitionId],
	)
	const dismissFailure = useCallback(() => setFailure(undefined), [])

	return { isBusy, failure, remove, removeOnServer, rotate, crop, dismissFailure }
}
