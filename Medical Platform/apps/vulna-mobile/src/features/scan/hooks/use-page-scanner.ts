import {
	type CapturedPage,
	type DocumentScanner,
	DocumentScannerView,
	type DocumentScannerViewHandle,
	documentScanner,
	type SecuredPage,
} from "@ansora/core-mobile"
import { useIsFocused } from "expo-router"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { JPEG_DATA_URI } from "../../../utils/base64"
import { randomUuid } from "../../../utils/random-uuid"
import { dropShot, showShotPreview, startShot } from "../../capture/capture-session"
import { CAMERA_ACCESS, type CameraAccess, useCameraAccess } from "../../capture/hooks/use-camera-capture"
import { keepScannedPage, type PhotoOwner, whenShotsKept } from "../../capture/photo-buffer"
import { isAtLimit } from "../../capture/shot-limit"
import { effectiveConfiguration } from "../../session/effective-configuration-store"
import { isDeviceQueueFull } from "../../upload/queue-limit"
import { SCAN_FAILURE, type ScanFailure, scanFailureOf } from "../scan-failure"
import { securedPageOf } from "../scanned-page"

export interface PageScanner {
	scanner: RefObject<DocumentScannerViewHandle | null>
	access: CameraAccess
	isActive: boolean
	isAvailable: boolean
	pageCount: number
	pageLimit: number | undefined
	isLimitReached: boolean
	canShoot: boolean
	failure: ScanFailure | undefined
	edgelessPage: string | undefined
	shoot: () => Promise<void>
	isReadyToContinue: () => Promise<boolean>
	dismissFailure: () => void
	dismissEdgelessPage: () => void
}

// CAP-018-R08, CAP-018-R03
async function scannedPageOf(scanner: DocumentScanner | undefined, id: string): Promise<SecuredPage> {
	if (scanner === undefined) {
		throw new Error("the document scanner is not available")
	}
	return securedPageOf(await scanner.scannedPage(id))
}

// CAP-018-R02, E17, E18
async function capturedPage(
	view: DocumentScannerViewHandle,
	acquisitionId: string,
	fileKey: string,
): Promise<CapturedPage> {
	startShot(acquisitionId, fileKey)
	try {
		const captured = await view.capturePage()
		if (captured.preview !== null) {
			showShotPreview(acquisitionId, fileKey, `${JPEG_DATA_URI}${captured.preview}`)
		}
		return captured
	} catch (error) {
		dropShot(acquisitionId, fileKey)
		throw error
	}
}

// CAP-018-R02, CAP-018-R03, CAP-018-R08, CAP-018-R10, CAP-018-R12, CAP-015-R36, CAP-019-S12, E16, E21
export function usePageScanner(owner: PhotoOwner, pageCount: number, replacedKey: string | undefined): PageScanner {
	const scanner = useRef<DocumentScannerViewHandle | null>(null)
	const isActive = useIsFocused()
	const access = useCameraAccess()
	const [isShooting, setShooting] = useState(false)
	const [failure, setFailure] = useState<ScanFailure | undefined>(undefined)
	const [edgelessPage, setEdgelessPage] = useState<string | undefined>(undefined)
	const shooting = useRef(false)
	const isOnScreen = useRef(false)
	const shownFailure = useRef<ScanFailure | undefined>(undefined)
	const edgeless = useRef<string | undefined>(undefined)
	const replacing = useRef(replacedKey)
	const pageLimit = effectiveConfiguration()?.document_max_pages
	const isLimitReached = isAtLimit(pageCount, pageLimit)
	const isAvailable = DocumentScannerView !== undefined
	const canShoot =
		access === CAMERA_ACCESS.GRANTED &&
		isAvailable &&
		!isShooting &&
		failure === undefined &&
		edgelessPage === undefined &&
		!isLimitReached

	// CAP-015-R36, CAP-019-S12
	useEffect(() => {
		replacing.current = replacedKey
	}, [replacedKey])

	const showFailure = useCallback((next: ScanFailure | undefined) => {
		shownFailure.current = next
		setFailure(next)
	}, [])
	const dismissFailure = useCallback(() => showFailure(undefined), [showFailure])
	const askAboutEdges = useCallback((fileKey: string | undefined) => {
		edgeless.current = fileKey
		setEdgelessPage(fileKey)
	}, [])
	const dismissEdgelessPage = useCallback(() => askAboutEdges(undefined), [askAboutEdges])

	useEffect(() => {
		isOnScreen.current = isActive
		if (!isActive) {
			showFailure(undefined)
			askAboutEdges(undefined)
		}
		return () => {
			isOnScreen.current = false
		}
	}, [isActive, showFailure, askAboutEdges])

	// E17, E18
	const losePage = useCallback(
		(fileKey: string, error: unknown) => {
			dropShot(owner.acquisitionId, fileKey)
			if (isOnScreen.current) {
				showFailure(scanFailureOf(error))
			}
		},
		[owner, showFailure],
	)

	// CAP-018-R10, CAP-015-R21, E21
	const isReadyToContinue = useCallback(async () => {
		await whenShotsKept()
		return edgeless.current === undefined && shownFailure.current === undefined
	}, [])

	const shoot = useCallback(async () => {
		const view = scanner.current
		// CAP-018-R12
		if (shooting.current || view === null || isLimitReached) {
			return
		}
		shooting.current = true
		setShooting(true)
		try {
			// CAP-019-R17, E24
			if (await isDeviceQueueFull()) {
				showFailure(SCAN_FAILURE.QUEUE_FULL)
				return
			}
			const fileKey = await randomUuid()
			const captured = await capturedPage(view, owner.acquisitionId, fileKey)
			const shot = { owner, fileKey, replacedKey: replacing.current ?? null }
			replacing.current = undefined
			void keepScannedPage(
				shot,
				() => scannedPageOf(documentScanner(), captured.id),
				(kept) => {
					if (kept.corners === null && isOnScreen.current) {
						askAboutEdges(kept.fileKey)
					}
				},
				(error) => {
					if (shot.replacedKey !== null && replacing.current === undefined) {
						replacing.current = shot.replacedKey
					}
					losePage(fileKey, error)
				},
			)
		} catch (error) {
			showFailure(scanFailureOf(error))
		} finally {
			shooting.current = false
			setShooting(false)
		}
	}, [isLimitReached, owner, askAboutEdges, losePage, showFailure])

	return {
		scanner,
		access,
		isActive,
		isAvailable,
		pageCount,
		pageLimit,
		isLimitReached,
		canShoot,
		failure,
		edgelessPage,
		shoot,
		isReadyToContinue,
		dismissFailure,
		dismissEdgelessPage,
	}
}
