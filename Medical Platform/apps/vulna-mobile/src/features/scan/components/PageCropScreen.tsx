import type { PageCorner, PageCorners } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { useRef, useState } from "react"
import { Image, type ImageLoadEvent, type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Svg, { Polygon } from "react-native-svg"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import sizes from "../../../styles/sizes.json"
import { Button } from "../../../ui/Button"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { Spinner } from "../../../ui/Spinner"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Label } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"
import type { Area } from "../../capture/capture-frame"
import { CaptureBackAction, CaptureNavBar } from "../../capture/components/CaptureNavBar"
import { HANDLE_REACH, NOTHING_SHOWN, type ShownPhoto, shownPhoto } from "../../capture/crop-geometry"
import { CORNER_NAMES, type CornerName, movedCorner, WHOLE_PAGE } from "../scanned-page"

const EDGE_WIDTH = 3
const HANDLE_CENTER = sizes["page-corner"] / 2

interface Props {
	patient: Patient
	imageUri: string | undefined
	detected: PageCorners
	isBusy: boolean
	onBack: () => void
	onApply: (corners: PageCorners) => void
}

// CAP-018-R10, CAP-018-R11, CAP-018-S02, E21, Figma 06 B.3
export function PageCropScreen({ patient, imageUri, detected, isBusy, onBack, onApply }: Props) {
	const texts = useTexts().scan.crop
	const [corners, setCorners] = useState(detected)
	const [frame, setFrame] = useState<Area>({ width: 0, height: 0 })
	const [image, setImage] = useState<Area | undefined>(undefined)
	const measure = (event: LayoutChangeEvent) => setFrame(event.nativeEvent.layout)
	const loaded = (event: ImageLoadEvent) => setImage(event.nativeEvent.source)
	const shown = image === undefined ? NOTHING_SHOWN : shownPhoto(frame, image)

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar title={texts.title} patient={patient} leading={<CaptureBackAction onPress={onBack} />} />
			<View className="aspect-photo w-full bg-capture-denied-surface" onLayout={measure}>
				{imageUri === undefined ? null : (
					<Image source={{ uri: imageUri }} className="h-full w-full" resizeMode={WHOLE_PHOTO} onLoad={loaded} />
				)}
				{image === undefined ? null : (
					<>
						<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
							<Polygon
								points={CORNER_NAMES.map((name) => pointText(corners[name], shown)).join(" ")}
								fill={colors["scan-edge-fill"]}
								stroke={colors["scan-edge"]}
								strokeWidth={EDGE_WIDTH}
								strokeLinejoin="round"
							/>
						</Svg>
						{CORNER_NAMES.map((name) => (
							<CornerHandle
								key={name}
								name={name}
								corner={corners[name]}
								shown={shown}
								isEnabled={!isBusy}
								onMove={(to) => setCorners((current) => movedCorner(current, name, to))}
							/>
						))}
					</>
				)}
				{isBusy || imageUri === undefined ? (
					<View className="absolute inset-0 items-center justify-center" pointerEvents="none">
						<Spinner color={colors["primary-foreground"]} />
					</View>
				) : null}
			</View>
			<View className="flex-1 justify-end pb-safe-gap-or-sheet">
				<View className="flex-row gap-2 px-screen">
					<Pressable
						className="group h-control flex-1 items-center justify-center rounded-control bg-capture-secondary"
						accessibilityRole="button"
						disabled={isBusy}
						onPress={() => setCorners(WHOLE_PAGE)}
					>
						<PressedOverlay className="rounded-control" />
						<Label className="text-background" numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
							{texts.whole}
						</Label>
					</Pressable>
					<View className="flex-1">
						<Button
							label={texts.apply}
							onPress={() => onApply(corners)}
							disabled={image === undefined}
							waiting={isBusy}
						/>
					</View>
				</View>
			</View>
		</View>
	)
}

function pointText(corner: PageCorner, shown: ShownPhoto): string {
	return `${shown.left + corner.x * shown.width},${shown.top + corner.y * shown.height}`
}

interface HandleProps {
	name: CornerName
	corner: PageCorner
	shown: ShownPhoto
	isEnabled: boolean
	onMove: (to: PageCorner) => void
}

function CornerHandle({ name, corner, shown, isEnabled, onMove }: HandleProps) {
	const texts = useTexts()
	const start = useRef<PageCorner>(corner)
	const drag = Gesture.Pan()
		.runOnJS(true)
		.enabled(isEnabled && shown.width > 0)
		.onStart(() => {
			start.current = corner
		})
		.onUpdate((event) =>
			onMove({
				x: start.current.x + event.translationX / shown.width,
				y: start.current.y + event.translationY / shown.height,
			}),
		)
	return (
		<GestureDetector gesture={drag}>
			<View
				className="absolute h-page-corner w-page-corner rounded-full border-ring border-scan-edge bg-primary-foreground"
				style={{
					left: shown.left + corner.x * shown.width - HANDLE_CENTER,
					top: shown.top + corner.y * shown.height - HANDLE_CENTER,
				}}
				hitSlop={HANDLE_REACH}
				accessible
				accessibilityLabel={fillText(texts.scan.crop.corner, { index: CORNER_NAMES.indexOf(name) + 1 }, texts.language)}
			/>
		</GestureDetector>
	)
}
