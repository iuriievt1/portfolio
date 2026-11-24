import type { BufferedFile, PageCorners } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { type CaptureFailure, captureFailureOf } from "../../capture/capture-failure"
import { recropPage, rotatePage } from "../page-crop"

interface PageCrop {
	isBusy: boolean
	failure: CaptureFailure | undefined
	recrop: (page: BufferedFile, corners: PageCorners) => Promise<boolean>
	rotate: (page: BufferedFile) => Promise<boolean>
	dismissFailure: () => void
}

// CAP-018-R10, CAP-018-R11, CAP-015-R34
export function usePageCrop(acquisitionId: string): PageCrop {
	const [isBusy, setBusy] = useState(false)
	const [failure, setFailure] = useState<CaptureFailure | undefined>(undefined)
	const busy = useRef(false)

	const run = useCallback(async (edit: () => Promise<void>): Promise<boolean> => {
		if (busy.current) {
			return false
		}
		busy.current = true
		setBusy(true)
		try {
			await edit()
			return true
		} catch (error) {
			setFailure(captureFailureOf(error))
			return false
		} finally {
			busy.current = false
			setBusy(false)
		}
	}, [])

	const recrop = useCallback(
		(page: BufferedFile, corners: PageCorners) => run(() => recropPage(acquisitionId, page, corners)),
		[run, acquisitionId],
	)
	const rotate = useCallback((page: BufferedFile) => run(() => rotatePage(acquisitionId, page)), [run, acquisitionId])
	const dismissFailure = useCallback(() => setFailure(undefined), [])

	return { isBusy, failure, recrop, rotate, dismissFailure }
}
