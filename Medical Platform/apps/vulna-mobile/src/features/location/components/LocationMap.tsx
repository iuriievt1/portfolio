import { type BodyDiagramDrawing, type BodyView, type DiagramPoint, drawingSize } from "@ansora/contracts"
import { useEffect, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import type { WoundChoice } from "../../capture/capture-session"
import {
	ALL_VIEWS_NEAR_SCALE,
	DEPTH,
	FADE_IN,
	FADE_IN_DELAY,
	FADE_OUT,
	HIDDEN,
	NATURAL_SCALE,
	SHOWN,
} from "../map-transition"
import { type Area, fitBox, type LocatedFinding, mapRegionOf, placedWounds, placementOfBox } from "../wound-map-layout"
import { FocusedFigure } from "./FocusedFigure"
import { WoundMap } from "./WoundMap"

interface Props {
	area: Area
	oneViewReserve: number | undefined
	drawing: BodyDiagramDrawing
	shownDrawing: BodyDiagramDrawing
	focusedView: BodyView | undefined
	wounds: readonly LocatedFinding[]
	selection: WoundChoice | undefined
	onMark: (point: DiagramPoint) => void
	onChooseWound: (wound: LocatedFinding) => void
}

// CAP-016-R17, clinical-workflow.yaml bodyDiagramBackground
export function LocationMap({
	area,
	oneViewReserve,
	drawing,
	shownDrawing,
	focusedView,
	wounds,
	selection,
	onMark,
	onChooseWound,
}: Props) {
	const isFocused = focusedView !== undefined
	const allViewsBox = fitBox(area, drawingSize(drawing.views))
	const allViewsPlacement = placementOfBox(area, allViewsBox)
	const allViewsWounds = useMemo(() => placedWounds(drawing, wounds), [drawing, wounds])
	const allViewsOpacity = useSharedValue(HIDDEN)
	const allViewsScale = useSharedValue(NATURAL_SCALE)

	useEffect(() => {
		allViewsOpacity.value = isFocused
			? withTiming(HIDDEN, FADE_OUT)
			: withDelay(FADE_IN_DELAY, withTiming(SHOWN, FADE_IN))
		allViewsScale.value = withTiming(isFocused ? ALL_VIEWS_NEAR_SCALE : NATURAL_SCALE, DEPTH)
	}, [isFocused, allViewsOpacity, allViewsScale])

	const fade = useAnimatedStyle(() => ({
		opacity: allViewsOpacity.value,
		transform: [{ scale: allViewsScale.value }],
	}))

	return (
		<View style={StyleSheet.absoluteFill}>
			<Animated.View
				pointerEvents={isFocused ? "none" : "auto"}
				renderToHardwareTextureAndroid
				style={[{ position: "absolute", left: allViewsPlacement.x, top: allViewsPlacement.y }, fade]}
			>
				<WoundMap
					drawing={drawing}
					wounds={allViewsWounds}
					selection={undefined}
					box={allViewsBox}
					onMark={onMark}
					onChooseWound={onChooseWound}
				/>
			</Animated.View>
			{focusedView === undefined || oneViewReserve === undefined ? null : (
				<OneView
					key={focusedView}
					area={area}
					reserve={oneViewReserve}
					shownDrawing={shownDrawing}
					view={focusedView}
					wounds={wounds}
					selection={selection}
					onMark={onMark}
					onChooseWound={onChooseWound}
				/>
			)}
		</View>
	)
}

interface OneViewProps {
	area: Area
	reserve: number
	shownDrawing: BodyDiagramDrawing
	view: BodyView
	wounds: readonly LocatedFinding[]
	selection: WoundChoice | undefined
	onMark: (point: DiagramPoint) => void
	onChooseWound: (wound: LocatedFinding) => void
}

// CAP-016-R17
function OneView({ area, reserve, shownDrawing, view, wounds, selection, onMark, onChooseWound }: OneViewProps) {
	const shownWounds = useMemo(() => placedWounds(shownDrawing, wounds), [shownDrawing, wounds])
	if (shownDrawing.views[view] === undefined) {
		return null
	}
	const region = mapRegionOf(area, reserve)
	const box = fitBox(region, drawingSize(shownDrawing.views))
	return (
		<FocusedFigure placement={placementOfBox(region, box)}>
			<WoundMap
				drawing={shownDrawing}
				wounds={shownWounds}
				selection={selection}
				box={box}
				onMark={onMark}
				onChooseWound={onChooseWound}
			/>
		</FocusedFigure>
	)
}
