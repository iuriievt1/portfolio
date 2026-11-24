import { Pressable } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { formatNumber } from "../../../utils/fill-text"
import { MARKER_HIT_SLOP, MARKER_SIZE } from "../wound-map-layout"

interface Props {
	x: number
	y: number
	label: string
	number: number | undefined
	isSelected: boolean
	onPress: (() => void) | undefined
}

const NEW_WOUND_ICON_SIZE = 12

// CAP-016-R17, CAP-015-R28, DESIGN.md 12.2
export function WoundMarker({ x, y, label, number, isSelected, onPress }: Props) {
	const texts = useTexts()
	const surface = isSelected ? "bg-primary" : "bg-background"
	const place = { position: "absolute", left: x - MARKER_SIZE / 2, top: y - MARKER_SIZE / 2 } as const
	return (
		<Pressable
			className={`h-mark w-mark items-center justify-center rounded-full border-mark border-primary ${surface}`}
			style={place}
			hitSlop={MARKER_HIT_SLOP}
			pointerEvents={onPress === undefined ? "none" : "auto"}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected: isSelected }}
			disabled={onPress === undefined}
			onPress={onPress}
		>
			{number === undefined ? (
				<PlusIcon size={NEW_WOUND_ICON_SIZE} color={colors["primary-foreground"]} />
			) : (
				<Caption tone={isSelected ? TEXT_TONE.ON_BRAND : TEXT_TONE.ACCENT} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
					{formatNumber(number, texts.language)}
				</Caption>
			)}
		</Pressable>
	)
}
