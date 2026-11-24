import { type BodyDiagramDrawing, type DiagramPoint, drawingSize, drawnViews } from "@ansora/contracts"
import { type GestureResponderEvent, Pressable, StyleSheet } from "react-native"
import Svg, { Circle, Line } from "react-native-svg"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { fillText } from "../../../utils/fill-text"
import { WOUND_CHOICE, type WoundChoice } from "../../capture/capture-session"
import {
	GUIDE_WIDTH,
	type LocatedFinding,
	type MapBox,
	type MarkerPlacement,
	type PlacedWound,
	placeMarkers,
	SPOT_RADIUS,
	SPOT_RING_WIDTH,
	spotOf,
	woundAt,
} from "../wound-map-layout"
import { BodySilhouette } from "./BodySilhouette"
import { WoundMarker } from "./WoundMarker"

interface Props {
	drawing: BodyDiagramDrawing
	wounds: readonly PlacedWound[]
	selection: WoundChoice | undefined
	box: MapBox
	onMark: (point: DiagramPoint) => void
	onChooseWound: (wound: LocatedFinding) => void
}

// CAP-016-R17, CAP-016-R04, clinical-workflow.yaml bodyDiagramBackground
export function WoundMap({ drawing, wounds, selection, box, onMark, onChooseWound }: Props) {
	const texts = useTexts()
	const location = texts.capture.location
	const size = drawingSize(drawing.views)
	const chosenId = selection?.kind === WOUND_CHOICE.EXISTING ? selection.finding.finding_id : undefined
	const newSpot = selection?.kind === WOUND_CHOICE.NEW ? spotOf(drawing, selection.bodySite) : undefined
	const woundSpots = wounds.map((wound) => wound.spot)
	const placements = placeMarkers(newSpot === undefined ? woundSpots : [...woundSpots, newSpot], box)
	const newPlacement = newSpot === undefined ? undefined : placements.at(-1)

	// CAP-016-R17
	const mark = (event: GestureResponderEvent) => {
		const point = { x: event.nativeEvent.locationX / box.scale, y: event.nativeEvent.locationY / box.scale }
		const touched = woundAt(point, wounds, box.scale)
		if (touched !== undefined) {
			onChooseWound(touched)
			return
		}
		onMark(point)
	}

	return (
		<Pressable style={{ width: box.width, height: box.height }} accessibilityLabel={location.map} onPress={mark}>
			<Svg width={box.width} height={box.height} viewBox={`0 0 ${size.width} ${size.height}`}>
				{drawnViews(drawing.views).map(([view, drawn]) => (
					<BodySilhouette key={view} view={drawn} />
				))}
			</Svg>
			<Svg style={StyleSheet.absoluteFill} width={box.width} height={box.height} pointerEvents="none">
				{placements.map((placement, index) =>
					placement.isDisplaced ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: wound order
						<Guide key={index} placement={placement} />
					) : null,
				)}
			</Svg>
			{wounds.map((wound, index) => {
				const placement = placements[index]
				return placement === undefined ? null : (
					<WoundMarker
						key={wound.finding.finding_id}
						x={placement.centre.x}
						y={placement.centre.y}
						label={fillText(location.existingWound, { number: wound.finding.number }, texts.language)}
						number={wound.finding.number}
						isSelected={wound.finding.finding_id === chosenId}
						onPress={() => onChooseWound(wound)}
					/>
				)
			})}
			{newPlacement === undefined ? null : (
				<WoundMarker
					x={newPlacement.centre.x}
					y={newPlacement.centre.y}
					label={location.newWound}
					number={undefined}
					isSelected
					onPress={undefined}
				/>
			)}
		</Pressable>
	)
}

function Guide({ placement }: { placement: MarkerPlacement }) {
	const { spot, centre } = placement
	return (
		<>
			<Line
				x1={spot.x}
				y1={spot.y}
				x2={centre.x}
				y2={centre.y}
				stroke={colors.primary}
				strokeWidth={GUIDE_WIDTH}
				strokeLinecap="round"
			/>
			<Circle
				cx={spot.x}
				cy={spot.y}
				r={SPOT_RADIUS}
				fill={colors.primary}
				stroke={colors.background}
				strokeWidth={SPOT_RING_WIDTH}
			/>
		</>
	)
}
