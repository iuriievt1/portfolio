import { useCallback } from "react"
import { Platform } from "react-native"
import {
	type CameraFrameOutput,
	type Frame,
	type FrameRenderer,
	useFrameOutput,
	useFrameRenderer,
} from "react-native-vision-camera"
import { PHOTO_RESOLUTION } from "./use-camera-capture"

interface CameraBackdrop {
	renderer: FrameRenderer
	frameOutput: CameraFrameOutput
}

const SHOWS_LIVE_BACKDROP = Platform.OS === "ios"

// Vulna / Capture / Backdrop, ⚠ Q-147
export function useCameraBackdrop(): CameraBackdrop | undefined {
	const renderer = useFrameRenderer()
	const onFrame = useCallback(
		(frame: Frame) => {
			"worklet"
			renderer.renderFrame(frame)
			frame.dispose()
		},
		[renderer],
	)
	const frameOutput = useFrameOutput({
		targetResolution: PHOTO_RESOLUTION,
		enablePreviewSizedOutputBuffers: true,
		enablePhysicalBufferRotation: true,
		onFrame,
	})
	return SHOWS_LIVE_BACKDROP ? { renderer, frameOutput } : undefined
}
