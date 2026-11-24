import type { BufferedFile, PhotoCrop } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { type LayoutChangeEvent, Pressable, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { Spinner } from "../../../ui/Spinner"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Body, Label, TEXT_TONE } from "../../../ui/typography"
import { clamp } from "../../../utils/clamp"
import { cropOf, HANDLE_REACH, NOTHING_SHOWN, type ShownPhoto, shownPhoto } from "../crop-geometry"
import { PhotoThumbnail } from "./PhotoThumbnail"

const MIN_SIDE = 64

const CORNER = {
	TOP_LEFT: "top-left",
	TOP_RIGHT: "top-right",
	BOTTOM_LEFT: "bottom-left",
	BOTTOM_RIGHT: "bottom-right",
} as const

type Corner = (typeof CORNER)[keyof typeof CORNER]

interface Edges {
	left: SharedValue<number>
	top: SharedValue<number>
	right: SharedValue<number>
	bottom: SharedValue<number>
}

interface Props {
	photo: BufferedFile
	isBusy: boolean
	onCancel: () => void
	onDone: (crop: PhotoCrop) => void
}

// CAP-015-R34, CAP-015-R03
export function CropScreen({ photo, isBusy, onCancel, onDone }: Props) {
	const texts = useTexts().capture.crop
	const [shown, setShown] = useState<ShownPhoto | undefined>(undefined)
	const edges: Edges = {
		left: useSharedValue(0),
		top: useSharedValue(0),
		right: useSharedValue(0),
		bottom: useSharedValue(0),
	}
	const { left, top, right, bottom } = edges

	const measure = (event: LayoutChangeEvent) => {
		const placed = shownPhoto(event.nativeEvent.layout, photo)
		setShown(placed)
		left.value = placed.left
		top.value = placed.top
		right.value = placed.left + placed.width
		bottom.value = placed.top + placed.height
	}

	const finish = () => {
		if (shown === undefined) {
			return
		}
		const crop = cropOf({ left: left.value, top: top.value, right: right.value, bottom: bottom.value }, shown)
		if (crop === undefined) {
			onCancel()
			return
		}
		onDone(crop)
	}

	const grip = useSharedValue({ left: 0, top: 0 })
	const limits = shown ?? NOTHING_SHOWN
	const move = Gesture.Pan()
		.onStart(() => {
			grip.value = { left: left.value, top: top.value }
		})
		.onUpdate((event) => {
			const boxWidth = right.value - left.value
			const boxHeight = bottom.value - top.value
			const nextLeft = clamp(grip.value.left + event.translationX, limits.left, limits.left + limits.width - boxWidth)
			const nextTop = clamp(grip.value.top + event.translationY, limits.top, limits.top + limits.height - boxHeight)
			left.value = nextLeft
			top.value = nextTop
			right.value = nextLeft + boxWidth
			bottom.value = nextTop + boxHeight
		})

	const box = useAnimatedStyle(() => ({
		left: left.value,
		top: top.value,
		width: right.value - left.value,
		height: bottom.value - top.value,
	}))
	const dimTop = useAnimatedStyle(() => ({ height: top.value }))
	const dimBottom = useAnimatedStyle(() => ({ top: bottom.value }))
	const dimLeft = useAnimatedStyle(() => ({ top: top.value, height: bottom.value - top.value, width: left.value }))
	const dimRight = useAnimatedStyle(() => ({ top: top.value, height: bottom.value - top.value, left: right.value }))

	return (
		<View className="flex-1 bg-black android:pt-safe">
			<StatusBar style="light" />
			<View className="h-capture-nav items-center justify-center">
				<Label tone={TEXT_TONE.ON_BRAND} accessibilityRole="header">
					{texts.title}
				</Label>
			</View>
			<View className="flex-1 justify-center">
				<View className="aspect-photo w-full" onLayout={measure}>
					<PhotoThumbnail photo={photo} className="h-full w-full" resizeMode={WHOLE_PHOTO} />
					<Animated.View className="absolute inset-x-0 top-0 bg-capture-dim" style={dimTop} pointerEvents="none" />
					<Animated.View
						className="absolute inset-x-0 bottom-0 bg-capture-dim"
						style={dimBottom}
						pointerEvents="none"
					/>
					<Animated.View className="absolute left-0 bg-capture-dim" style={dimLeft} pointerEvents="none" />
					<Animated.View className="absolute right-0 bg-capture-dim" style={dimRight} pointerEvents="none" />
					<GestureDetector gesture={move}>
						<Animated.View className="absolute border border-primary-foreground" style={box}>
							<Handle corner={CORNER.TOP_LEFT} edges={edges} limits={limits} />
							<Handle corner={CORNER.TOP_RIGHT} edges={edges} limits={limits} />
							<Handle corner={CORNER.BOTTOM_LEFT} edges={edges} limits={limits} />
							<Handle corner={CORNER.BOTTOM_RIGHT} edges={edges} limits={limits} />
						</Animated.View>
					</GestureDetector>
					{isBusy ? (
						<View className="absolute inset-0 items-center justify-center" pointerEvents="none">
							<Spinner color={colors["primary-foreground"]} />
						</View>
					) : null}
				</View>
			</View>
			<View className="h-toolbar flex-row items-center justify-between px-screen pb-safe-gap-or-sheet">
				<Pressable accessibilityRole="button" disabled={isBusy} onPress={onCancel}>
					<Body tone={TEXT_TONE.ON_BRAND} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
						{texts.cancel}
					</Body>
				</Pressable>
				<Pressable accessibilityRole="button" disabled={isBusy} onPress={finish}>
					<Label tone={TEXT_TONE.ON_BRAND} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
						{texts.done}
					</Label>
				</Pressable>
			</View>
		</View>
	)
}

function Handle({ corner, edges, limits }: { corner: Corner; edges: Edges; limits: ShownPhoto }) {
	const start = useSharedValue({ x: 0, y: 0 })
	const isLeft = corner === CORNER.TOP_LEFT || corner === CORNER.BOTTOM_LEFT
	const isTop = corner === CORNER.TOP_LEFT || corner === CORNER.TOP_RIGHT

	const drag = Gesture.Pan()
		.onStart(() => {
			start.value = {
				x: isLeft ? edges.left.value : edges.right.value,
				y: isTop ? edges.top.value : edges.bottom.value,
			}
		})
		.onUpdate((event) => {
			const x = start.value.x + event.translationX
			const y = start.value.y + event.translationY
			if (isLeft) {
				edges.left.value = clamp(x, limits.left, edges.right.value - MIN_SIDE)
			} else {
				edges.right.value = clamp(x, edges.left.value + MIN_SIDE, limits.left + limits.width)
			}
			if (isTop) {
				edges.top.value = clamp(y, limits.top, edges.bottom.value - MIN_SIDE)
			} else {
				edges.bottom.value = clamp(y, edges.top.value + MIN_SIDE, limits.top + limits.height)
			}
		})

	const side = `${isTop ? "top-0 border-t-handle" : "bottom-0 border-b-handle"} ${isLeft ? "left-0 border-l-handle" : "right-0 border-r-handle"}`
	return (
		<GestureDetector gesture={drag}>
			<Animated.View
				className={`absolute h-handle w-handle border-primary-foreground ${side}`}
				hitSlop={HANDLE_REACH}
			/>
		</GestureDetector>
	)
}
