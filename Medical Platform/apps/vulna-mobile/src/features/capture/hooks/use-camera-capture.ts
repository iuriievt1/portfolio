import { camera } from "@ansora/core-mobile"
import { useIsFocused } from "expo-router"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus, Platform } from "react-native"
import type { Image } from "react-native-nitro-image"
import {
	type CameraDevice,
	type CameraPhotoOutput,
	type CameraRef,
	CommonResolutions,
	type Photo,
	useCameraDevice,
	usePhotoOutput,
} from "react-native-vision-camera"
import { jpegDataUriOf } from "../../../utils/base64"
import { randomUuid } from "../../../utils/random-uuid"
import { hasCameraAccess } from "../../code-scan/camera-access"
import { useCameraLifecycle } from "../../code-scan/hooks/use-camera-lifecycle"
import { effectiveConfiguration } from "../../session/effective-configuration-store"
import { isDeviceQueueFull } from "../../upload/queue-limit"
import { CAPTURE_FAILURE, type CaptureFailure, captureFailureOf } from "../capture-failure"
import { dropShot, showShotPreview, startShot } from "../capture-session"
import { keepCapturedPhoto, type PhotoOwner, whenShotsKept } from "../photo-buffer"
import { copiedBytesOf } from "../photo-bytes"
import { previewSizeOf } from "../preview-size"
import { isAtLimit } from "../shot-limit"

const BACK_CAMERA = "back"
// CAP-015-R10
const MAIN_LENS_ONLY = { physicalDevices: ["wide-angle" as const] }
// CAP-015-R03
export const PHOTO_RESOLUTION = CommonResolutions.HIGHEST_4_3
const JPEG = "jpeg"
const BEST_QUALITY = "quality"
const NO_FLASH = { flashMode: "off" } as const
// CAP-015-R10
const PREVIEW_SIZE = { width: 512, height: 384 }
const PREVIEW_LONGEST_SIDE = PREVIEW_SIZE.width
const SNAPSHOTS_PREVIEW = Platform.OS === "android"
const PREVIEW_FORMAT = "jpg"
const PREVIEW_QUALITY = 70
const ACTIVE_APP: AppStateStatus = "active"

export const CAMERA_ACCESS = {
	CHECKING: "checking",
	GRANTED: "granted",
	DENIED: "denied",
} as const

export type CameraAccess = (typeof CAMERA_ACCESS)[keyof typeof CAMERA_ACCESS]

export interface CameraCapture {
	cameraRef: RefObject<CameraRef | null>
	device: CameraDevice | undefined
	photoOutput: CameraPhotoOutput
	access: CameraAccess
	isActive: boolean
	sessionKey: number
	isPreviewing: boolean
	photoCount: number
	photoLimit: number | undefined
	isLimitReached: boolean
	canShoot: boolean
	failure: CaptureFailure | undefined
	onPreviewStarted: () => void
	onPreviewStopped: () => void
	onCameraError: (error: Error) => void
	shoot: () => Promise<void>
	isReadyToContinue: () => Promise<boolean>
	dismissFailure: () => void
	retryCamera: () => void
}

// CAP-015-R10, CAP-009-R11
async function previewUriOf(preview: Image): Promise<string> {
	try {
		const encoded = await preview.toEncodedImageDataAsync(PREVIEW_FORMAT, PREVIEW_QUALITY)
		return jpegDataUriOf(new Uint8Array(encoded.buffer))
	} finally {
		preview.dispose()
	}
}

// CAP-015-R10
function showPreview(acquisitionId: string, fileKey: string, preview: Image): void {
	previewUriOf(preview)
		.then((uri) => showShotPreview(acquisitionId, fileKey, uri))
		.catch((problem: unknown) => console.warn("a photo preview could not be shown", problem))
}

// CAP-015-R10, CAP-009-R11
async function shrunkPreviewOf(image: Image): Promise<Image> {
	try {
		const size = previewSizeOf(image.width, image.height, PREVIEW_LONGEST_SIDE)
		return await image.resizeAsync(size.width, size.height)
	} finally {
		image.dispose()
	}
}

// CAP-015-R10
async function showPhotoPreview(acquisitionId: string, fileKey: string, photo: Photo): Promise<void> {
	try {
		showPreview(acquisitionId, fileKey, await shrunkPreviewOf(await photo.toImageAsync()))
	} catch (problem) {
		console.warn("a photo preview could not be made", problem)
	}
}

// CAP-015-R10
function showSnapshotPreview(view: CameraRef, show: (preview: Image) => void): void {
	view
		.takeSnapshot()
		.then(shrunkPreviewOf)
		.then(show)
		.catch((problem: unknown) => console.warn("a preview snapshot could not be made", problem))
}

// CAP-015-R10
async function takePhoto(
	output: CameraPhotoOutput,
	view: CameraRef | null,
	acquisitionId: string,
	fileKey: string,
): Promise<Uint8Array> {
	let isPreviewShown = false
	const show = (preview: Image) => {
		isPreviewShown = true
		showPreview(acquisitionId, fileKey, preview)
	}
	if (SNAPSHOTS_PREVIEW && view !== null) {
		showSnapshotPreview(view, show)
	}
	const photo = await output.capturePhoto(NO_FLASH, { onPreviewImageAvailable: show })
	try {
		const bytes = copiedBytesOf(await photo.getFileDataAsync())
		if (!isPreviewShown) {
			await showPhotoPreview(acquisitionId, fileKey, photo)
		}
		return bytes
	} finally {
		photo.dispose()
	}
}

// CAP-015-R10, E17, E18
async function takeShot(
	output: CameraPhotoOutput,
	view: CameraRef | null,
	acquisitionId: string,
	fileKey: string,
): Promise<Uint8Array> {
	startShot(acquisitionId, fileKey)
	try {
		return await takePhoto(output, view, acquisitionId, fileKey)
	} catch (error) {
		dropShot(acquisitionId, fileKey)
		throw error
	}
}

async function cameraAccessNow(): Promise<CameraAccess> {
	try {
		return (await hasCameraAccess()) ? CAMERA_ACCESS.GRANTED : CAMERA_ACCESS.DENIED
	} catch {
		return CAMERA_ACCESS.DENIED
	}
}

// CAP-015-S02, E16
export function useCameraAccess(): CameraAccess {
	const [access, setAccess] = useState<CameraAccess>(CAMERA_ACCESS.CHECKING)
	const isMounted = useRef(true)

	const check = useCallback(async () => {
		const checked = await cameraAccessNow()
		if (isMounted.current) {
			setAccess(checked)
		}
	}, [])

	useEffect(() => {
		isMounted.current = true
		void check()
		return () => {
			isMounted.current = false
		}
	}, [check])

	useEffect(() => {
		if (access !== CAMERA_ACCESS.DENIED) {
			return
		}
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === ACTIVE_APP) {
				void check()
			}
		})
		return () => subscription.remove()
	}, [access, check])

	return access
}

// CAP-015-R10, CAP-015-R03, CAP-015-R13, CAP-015-S02, CAP-015-R36, CAP-019-S12
export function useCameraCapture(
	owner: PhotoOwner,
	photoCount: number,
	replacedKey: string | undefined,
): CameraCapture {
	const device = useCameraDevice(BACK_CAMERA, MAIN_LENS_ONLY)
	const photoOutput = usePhotoOutput({
		targetResolution: PHOTO_RESOLUTION,
		containerFormat: JPEG,
		qualityPrioritization: BEST_QUALITY,
		previewImageTargetSize: PREVIEW_SIZE,
	})
	const isFocused = useIsFocused()
	const access = useCameraAccess()
	const [isPreviewing, setPreviewing] = useState(false)
	const [isShooting, setShooting] = useState(false)
	const [failure, setFailure] = useState<CaptureFailure | undefined>(undefined)
	const cameraRef = useRef<CameraRef>(null)
	const shooting = useRef(false)
	const isOnScreen = useRef(false)
	const shownFailure = useRef<CaptureFailure | undefined>(undefined)
	const replacing = useRef(replacedKey)
	const photoLimit = effectiveConfiguration()?.acquisition_max_images
	const isLimitReached = isAtLimit(photoCount, photoLimit)

	// CAP-015-R36, CAP-019-S12
	useEffect(() => {
		replacing.current = replacedKey
	}, [replacedKey])

	const showFailure = useCallback((next: CaptureFailure | undefined) => {
		shownFailure.current = next
		setFailure(next)
	}, [])

	// E130
	const loseCamera = useCallback(() => {
		if (isOnScreen.current) {
			showFailure(CAPTURE_FAILURE.CAMERA_UNAVAILABLE)
		}
	}, [showFailure])
	const lifecycle = useCameraLifecycle(isFocused, loseCamera)

	useEffect(() => {
		isOnScreen.current = isFocused
		if (!isFocused) {
			showFailure(undefined)
		}
		return () => {
			isOnScreen.current = false
		}
	}, [isFocused, showFailure])

	const onPreviewStarted = useCallback(() => setPreviewing(true), [])
	const onPreviewStopped = useCallback(() => setPreviewing(false), [])
	const dismissFailure = useCallback(() => showFailure(undefined), [showFailure])
	const { restart } = lifecycle
	const retryCamera = useCallback(() => {
		showFailure(undefined)
		restart()
	}, [showFailure, restart])

	// E17, E18
	const loseShot = useCallback(
		(fileKey: string, error: unknown) => {
			dropShot(owner.acquisitionId, fileKey)
			if (isOnScreen.current) {
				showFailure(captureFailureOf(error))
			}
		},
		[owner, showFailure],
	)

	// CAP-015-R33, CAP-015-R21
	const isReadyToContinue = useCallback(async () => {
		await whenShotsKept()
		return shownFailure.current === undefined
	}, [])

	const shoot = useCallback(async () => {
		// CAP-015-R13
		if (shooting.current || isLimitReached) {
			return
		}
		shooting.current = true
		setShooting(true)
		try {
			// CAP-019-R17, E24
			if (await isDeviceQueueFull()) {
				showFailure(CAPTURE_FAILURE.QUEUE_FULL)
				return
			}
			const fileKey = await randomUuid()
			const photo = await takeShot(photoOutput, cameraRef.current, owner.acquisitionId, fileKey)
			const shot = { owner, fileKey, replacedKey: replacing.current ?? null }
			replacing.current = undefined
			void keepCapturedPhoto(shot, photo, (error) => {
				if (shot.replacedKey !== null && replacing.current === undefined) {
					replacing.current = shot.replacedKey
				}
				loseShot(fileKey, error)
			})
		} catch (error) {
			showFailure(captureFailureOf(error))
		} finally {
			shooting.current = false
			setShooting(false)
		}
	}, [isLimitReached, photoOutput, owner, loseShot, showFailure])

	const canShoot =
		access === CAMERA_ACCESS.GRANTED && isPreviewing && !isShooting && failure === undefined && !isLimitReached
	const isReady = useRef(canShoot)
	isReady.current = canShoot

	// CAP-015-R10
	useEffect(() => {
		if (!isFocused || access !== CAMERA_ACCESS.GRANTED) {
			return
		}
		const subscription = camera().addListener("shutterKey", () => {
			if (isReady.current) {
				void shoot()
			}
		})
		return () => subscription.remove()
	}, [isFocused, access, shoot])

	return {
		cameraRef,
		device,
		photoOutput,
		access,
		isActive: lifecycle.isActive,
		sessionKey: lifecycle.sessionKey,
		isPreviewing,
		photoCount,
		photoLimit,
		isLimitReached,
		canShoot,
		failure,
		onPreviewStarted,
		onPreviewStopped,
		onCameraError: lifecycle.onError,
		shoot,
		isReadyToContinue,
		dismissFailure,
		retryCamera,
	}
}
