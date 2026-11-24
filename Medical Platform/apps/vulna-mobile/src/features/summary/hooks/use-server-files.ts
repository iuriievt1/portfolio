import { SHOWN_FILE } from "@ansora/core-mobile"
import { useState } from "react"
import type { CaptureFailure } from "../../capture/capture-failure"
import { usePhotoEdits } from "../../capture/hooks/use-photo-edits"
import { retakeInPlace, retakeOfCondition } from "../retake"
import type { RecordFile } from "../shown-file"

export interface ServerFiles {
	opened: RecordFile | undefined
	isBusy: boolean
	failure: CaptureFailure | undefined
	open: (file: RecordFile, openOnDevice: (fileKey: string) => void) => void
	close: () => void
	retake: () => Promise<void>
	remove: () => Promise<void>
	dismissFailure: () => void
}

// CAP-015-R18, CAP-015-R36, CAP-015-S51, CAP-019-S12, CAP-009-S05, Q-076
export function useServerFiles(
	acquisitionId: string,
	onRetake: (replacedKey: string | undefined) => void,
): ServerFiles {
	const edits = usePhotoEdits(acquisitionId)
	const [opened, setOpened] = useState<RecordFile | undefined>(undefined)

	const close = () => setOpened(undefined)

	// CAP-015-R35, CAP-015-R36, Q-076
	const open = (file: RecordFile, openOnDevice: (fileKey: string) => void) => {
		if (file.kind === SHOWN_FILE.LOCAL) {
			openOnDevice(file.fileKey)
			return
		}
		setOpened(file)
	}

	const remove = async () => {
		if (opened !== undefined) {
			await edits.removeOnServer(opened.fileKey)
		}
		close()
	}

	const retake = async () => {
		const retakeOfOpened = opened === undefined ? undefined : retakeOfCondition(opened.condition)
		if (opened !== undefined && retakeOfOpened !== undefined) {
			await retakeInPlace(retakeOfOpened, opened.fileKey, () => edits.removeOnServer(opened.fileKey), onRetake)
		}
		close()
	}

	return {
		opened,
		isBusy: edits.isBusy,
		failure: edits.failure,
		open,
		close,
		retake,
		remove,
		dismissFailure: edits.dismissFailure,
	}
}
