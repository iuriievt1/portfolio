import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { type TargetBarcodeFormat, useBarcodeScanner } from "react-native-nitro-zxing"
import { Camera, type Frame, useFrameOutput } from "react-native-vision-camera"
import { scheduleOnRN } from "react-native-worklets"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { useCameraLifecycle } from "../hooks/use-camera-lifecycle"

export const QR_CODE_ONLY: TargetBarcodeFormat[] = ["qr-code"]
// identity.yaml loginWithBarcode
export const EMPLOYEE_CARD_CODE_ONLY: TargetBarcodeFormat[] = ["code-39"]
// CAP-013-R02
export const PATIENT_CODE_FORMATS: TargetBarcodeFormat[] = ["code-128", "code-39", "ean-13", "qr-code", "data-matrix"]
const BACK_CAMERA = "back"
const LUMINANCE_FRAMES = "yuv"

interface Props {
	scanning: boolean
	formats: TargetBarcodeFormat[]
	onScanned: (content: string) => void
	onCancel: () => void
}

// NAB-474, CAP-013-R20, E130
export function CodeScanSheet({ scanning, formats, onScanned, onCancel }: Props) {
	const strings = useTexts()
	const scanner = useBarcodeScanner({ barcodeFormats: formats })
	const [isCameraLost, setCameraLost] = useState(false)
	const onFrame = useCallback(
		(frame: Frame) => {
			"worklet"
			const [code] = scanner.scanCodes(frame)
			frame.dispose()
			if (code?.rawValue !== undefined) {
				scheduleOnRN(onScanned, code.rawValue)
			}
		},
		[scanner, onScanned],
	)
	const frames = useFrameOutput({ pixelFormat: LUMINANCE_FRAMES, onFrame })
	const lifecycle = useCameraLifecycle(scanning, () => setCameraLost(true))
	const { restart } = lifecycle
	const retryCamera = useCallback(() => {
		setCameraLost(false)
		restart()
	}, [restart])

	return (
		<View className="gap-4 bg-card p-screen android:pb-safe-gap-or-screen">
			<View className="h-scan overflow-hidden rounded-scan bg-foreground">
				<Camera
					key={lifecycle.sessionKey}
					style={StyleSheet.absoluteFill}
					device={BACK_CAMERA}
					isActive={lifecycle.isActive}
					outputs={[frames]}
					onError={lifecycle.onError}
				/>
			</View>
			<Button label={strings.codeScan.cancel} onPress={onCancel} style={BUTTON_STYLE.SECONDARY} />
			{isCameraLost ? (
				<ConfirmDialog
					title={strings.cameraUnavailable.title}
					body={strings.cameraUnavailable.body}
					primary={{ label: strings.cameraUnavailable.retry, onPress: retryCamera }}
					secondary={{ label: strings.codeScan.cancel, onPress: onCancel }}
				/>
			) : null}
		</View>
	)
}
