import { FILE_CONDITION, type FileCondition } from "@ansora/core-mobile"
import type { ReactNode } from "react"
import { Text, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { TimeIcon } from "../../../ui/icons/TimeIcon"
import { fileStateLabelOf, type Retake, retakeMarkLabelOf } from "../retake"

const MARK = "!"
const WAITING_GLYPH_SIZE = 14

interface Props {
	label: string
}

interface FrameProps {
	retake: Retake
	className: string
	children: ReactNode
}

// E112, CAP-015-R36, CAP-009-S05, Q-076, Figma 05 H.4
function RetakeMark({ label }: Props) {
	return (
		<View
			className="absolute inset-0 rounded-md border-selected border-file-rejected"
			pointerEvents="none"
			accessible
			accessibilityLabel={label}
		>
			<View className="absolute top-0.5 right-1.5 h-file-mark w-file-mark items-center justify-center rounded-full bg-file-rejected">
				<Text
					className="font-semibold text-file-mark text-primary-foreground"
					maxFontSizeMultiplier={CONTROL_FONT_SCALE}
					importantForAccessibility="no"
				>
					{MARK}
				</Text>
			</View>
		</View>
	)
}

// CAP-015-R35, CAP-015-S51, E111
function WaitingMark({ label }: Props) {
	return (
		<View
			className="absolute inset-0 rounded-md border-selected border-label-secondary"
			pointerEvents="none"
			accessible
			accessibilityLabel={label}
		>
			<View className="absolute top-0.5 right-1.5 h-file-mark w-file-mark items-center justify-center rounded-full bg-label-secondary">
				<TimeIcon size={WAITING_GLYPH_SIZE} color={colors["primary-foreground"]} />
			</View>
		</View>
	)
}

// CAP-015-R35, CAP-015-R36, CAP-009-S05, E111, E112, Q-076
export function FileStateMark({ condition }: { condition: FileCondition }) {
	const texts = useTexts()
	const label = fileStateLabelOf(condition, texts)
	if (label === undefined) {
		return null
	}
	return condition === FILE_CONDITION.ON_OTHER_DEVICE ? <WaitingMark label={label} /> : <RetakeMark label={label} />
}

// E112, CAP-015-R36, CAP-009-S05, Q-076
export function RetakeFrame({ retake, className, children }: FrameProps) {
	const texts = useTexts()
	return (
		<View className={className}>
			{children}
			<RetakeMark label={retakeMarkLabelOf(retake, texts)} />
		</View>
	)
}
