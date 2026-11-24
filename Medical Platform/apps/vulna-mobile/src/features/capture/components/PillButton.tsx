import { Pressable, Text } from "react-native"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { PressedOverlay } from "../../../ui/PressedOverlay"

interface Props {
	label: string
	className: string
	isEnabled?: boolean
	isBusy?: boolean
	onPress: () => void
}

// Vulna / Capture / Controls
export function PillButton({ label, className, isEnabled = true, isBusy = false, onPress }: Props) {
	return (
		<Pressable
			className={`group h-12 items-center justify-center rounded-3xl ${isEnabled ? "bg-primary" : "bg-capture-control-disabled"} ${className}`}
			accessibilityRole="button"
			disabled={!isEnabled || isBusy}
			onPress={onPress}
		>
			<PressedOverlay className="rounded-3xl" />
			<Text
				className={`font-semibold text-detail ${isEnabled ? "text-primary-foreground" : "text-capture-on-surface-disabled"}`}
				numberOfLines={1}
				maxFontSizeMultiplier={CONTROL_FONT_SCALE}
			>
				{label}
			</Text>
		</Pressable>
	)
}
