import { type LayoutChangeEvent, View } from "react-native"
import { OpenRow } from "../../../ui/OpenRow"
import { Caption, Detail, Label, TEXT_TONE } from "../../../ui/typography"
import type { ScheduledTime } from "../overview-rows"
import { WaitingSince } from "./WaitingSince"

interface WorkProps {
	patient: string
	detail: string
	waitingSince?: string
	onPress: () => void
}

// CAP-015-R29, CAP-015-R18, CAP-013-R19, CHG-176, E57
export function WorkRow({ patient, detail, waitingSince, onPress }: WorkProps) {
	return (
		<OpenRow onPress={onPress}>
			<View className="flex-1 gap-1">
				<Label>{patient}</Label>
				<Detail>{detail}</Detail>
				<WaitingSince label={waitingSince} />
			</View>
		</OpenRow>
	)
}

interface PlannedProps {
	time: ScheduledTime
	timeWidth: number | undefined
	patient: string
	onPress: () => void
}

const KNOWN_TIME_LINES = 1
const UNKNOWN_TIME_LINES = 2

// CAP-014-R16, CAP-014-S13, CAP-015-R28, CHG-176
export function PlannedRow({ time, timeWidth, patient, onPress }: PlannedProps) {
	const width = { width: timeWidth }
	return (
		<OpenRow onPress={onPress}>
			{time.isKnown ? (
				<Label numberOfLines={KNOWN_TIME_LINES} className="min-w-planned-time self-start" style={width}>
					{time.text}
				</Label>
			) : (
				<Caption
					tone={TEXT_TONE.MUTED}
					numberOfLines={UNKNOWN_TIME_LINES}
					className="min-w-planned-time self-start"
					style={width}
				>
					{time.text}
				</Caption>
			)}
			<View className="flex-1">
				<Label>{patient}</Label>
			</View>
		</OpenRow>
	)
}

interface TimeMeasureProps {
	times: readonly string[]
	onWidth: (width: number) => void
}

// CAP-015-R28
export function PlannedTimeMeasure({ times, onWidth }: TimeMeasureProps) {
	const measure = (event: LayoutChangeEvent) => onWidth(Math.ceil(event.nativeEvent.layout.width))
	return (
		<View
			className="absolute opacity-0"
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			onLayout={measure}
		>
			{times.map((time) => (
				<Label key={time} numberOfLines={KNOWN_TIME_LINES}>
					{time}
				</Label>
			))}
		</View>
	)
}
