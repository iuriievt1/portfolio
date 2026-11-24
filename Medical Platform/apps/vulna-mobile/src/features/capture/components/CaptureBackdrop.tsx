import { BlurView } from "expo-blur"
import { useState } from "react"
import { type LayoutChangeEvent, StyleSheet, View } from "react-native"
import { type FrameRenderer, NativeFrameRendererView } from "react-native-vision-camera"
import { type Area, frameCovering } from "../capture-frame"

const FULL_BLUR = 100
const UNTINTED_BLUR = "systemUltraThinMaterialDark"

// Vulna / Capture / Backdrop, ⚠ Q-147
export function CaptureBackdrop({ renderer }: { renderer: FrameRenderer }) {
	const [area, setArea] = useState<Area>({ width: 0, height: 0 })
	const measure = (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)
	const cover = frameCovering(area)

	return (
		<View
			className="absolute inset-0 overflow-hidden bg-black"
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			onLayout={measure}
		>
			<NativeFrameRendererView
				renderer={renderer}
				style={{
					position: "absolute",
					width: cover.width,
					height: cover.height,
					left: (area.width - cover.width) / 2,
					top: (area.height - cover.height) / 2,
				}}
			/>
			<BlurView style={StyleSheet.absoluteFill} intensity={FULL_BLUR} tint={UNTINTED_BLUR} />
			<View className="absolute inset-0 bg-capture-dim" />
		</View>
	)
}
