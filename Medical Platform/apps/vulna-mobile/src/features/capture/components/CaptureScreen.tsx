import type { BufferedFile, TorchMode } from "@ansora/core-mobile"
import { TORCH_MODE } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { type LayoutChangeEvent, StyleSheet, View } from "react-native"
import { Camera } from "react-native-vision-camera"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { ClearIcon } from "../../../ui/icons/ClearIcon"
import { type Area, frameWithin } from "../capture-frame"
import { useCameraBackdrop } from "../hooks/use-camera-backdrop"
import { CAMERA_ACCESS, type CameraCapture } from "../hooks/use-camera-capture"
import { CameraDenied } from "./CameraDenied"
import { CaptureBackdrop } from "./CaptureBackdrop"
import { CaptureControls } from "./CaptureControls"
import { CaptureFailureDialog } from "./CaptureFailureDialog"
import { CaptureNavAction, CaptureNavBar } from "./CaptureNavBar"
import { FileCounter } from "./FileCounter"
import { SeriesRow } from "./SeriesRow"

const WHOLE_FRAME = "contain"

// CAP-015-R10
function torchModeOf(isPreviewing: boolean, isTorchOn: boolean): TorchMode | undefined {
	if (!isPreviewing) {
		return undefined
	}
	return isTorchOn ? TORCH_MODE.ON : TORCH_MODE.OFF
}

interface Props {
	patient: Patient
	photos: readonly BufferedFile[]
	shots: readonly string[]
	previews: ReadonlyMap<string, string>
	camera: CameraCapture
	isTorchOn: boolean
	onTorch: () => void
	onClose: () => void
	onContinue: () => void
	onReview: (fileKey: string) => void
}

// CAP-015-R10, CAP-015-R31, CAP-015-R13, CAP-015-S02, E16, E130, Vulna / Capture / Camera sheet
export function CaptureScreen({
	patient,
	photos,
	shots,
	previews,
	camera,
	isTorchOn,
	onTorch,
	onClose,
	onContinue,
	onReview,
}: Props) {
	const texts = useTexts().capture
	const backdrop = useCameraBackdrop()
	const [area, setArea] = useState<Area>({ width: 0, height: 0 })
	const measure = (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)
	const isGranted = camera.access === CAMERA_ACCESS.GRANTED
	const isDenied = camera.access === CAMERA_ACCESS.DENIED

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			{isGranted && backdrop !== undefined ? <CaptureBackdrop renderer={backdrop.renderer} /> : null}
			<CaptureNavBar
				title={texts.title}
				patient={patient}
				leading={
					<CaptureNavAction label={texts.close} onPress={onClose}>
						<ClearIcon color={colors["primary-foreground"]} />
					</CaptureNavAction>
				}
			/>
			<View className="flex-1 items-center" onLayout={measure}>
				<View style={frameWithin(area)}>
					{isGranted && camera.device !== undefined ? (
						<Camera
							key={camera.sessionKey}
							ref={camera.cameraRef}
							style={StyleSheet.absoluteFill}
							device={camera.device}
							isActive={camera.isActive}
							outputs={backdrop === undefined ? [camera.photoOutput] : [camera.photoOutput, backdrop.frameOutput]}
							torchMode={torchModeOf(camera.isPreviewing, isTorchOn)}
							resizeMode={WHOLE_FRAME}
							enableNativeTapToFocusGesture
							onPreviewStarted={camera.onPreviewStarted}
							onPreviewStopped={camera.onPreviewStopped}
							onError={camera.onCameraError}
						/>
					) : null}
					{isDenied ? <CameraDenied /> : null}
				</View>
			</View>
			<View className="pb-safe-gap-or-sheet">
				<View className="flex-row items-center">
					<View className="flex-1">
						<SeriesRow
							photos={photos}
							shots={shots}
							previews={previews}
							hasSlot={isGranted && !camera.isLimitReached}
							onSelect={onReview}
						/>
					</View>
					{camera.photoLimit === undefined ? null : (
						<FileCounter count={camera.photoCount} limit={camera.photoLimit} label={texts.counter} />
					)}
				</View>
				<CaptureControls
					canUseCamera={isGranted}
					canShoot={camera.canShoot}
					canContinue={photos.length + shots.length > 0}
					onTorch={onTorch}
					onShoot={() => void camera.shoot()}
					onContinue={onContinue}
				/>
			</View>
			<CaptureFailureDialog
				failure={camera.failure}
				onDismiss={camera.dismissFailure}
				onRetryCamera={camera.retryCamera}
			/>
		</View>
	)
}
