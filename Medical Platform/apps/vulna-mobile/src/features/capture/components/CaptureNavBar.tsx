import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { BackIcon } from "../../../ui/icons/BackIcon"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { SYSTEM_SYMBOL, SystemSymbol } from "../../../ui/SystemSymbol"
import { Label, TEXT_TONE } from "../../../ui/typography"
import { PatientLine } from "../../patient/components/PatientLine"

interface Props {
	title: string
	patient: Patient
	leading: ReactNode
}

// CAP-015-R31, CAP-013-R09, Vulna / Native / Sheet title bar
export function CaptureNavBar({ title, patient, leading }: Props) {
	return (
		<View className="flex-row items-center gap-3 px-4 pt-4 pb-2.5 android:pt-safe-offset-4">
			{leading}
			<View className="flex-1 items-center">
				<Label
					tone={TEXT_TONE.ON_BRAND}
					accessibilityRole="header"
					numberOfLines={1}
					maxFontSizeMultiplier={CONTROL_FONT_SCALE}
				>
					{title}
				</Label>
				<PatientLine patient={patient} onDark />
			</View>
			<View className="w-11" />
		</View>
	)
}

export function CaptureNavAction({
	label,
	onPress,
	children,
}: {
	label: string
	onPress: () => void
	children: ReactNode
}) {
	return (
		<Pressable
			className="group h-11 w-11 items-center justify-center rounded-full bg-capture-close"
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
		>
			<PressedOverlay className="rounded-full" />
			{children}
		</Pressable>
	)
}

// CAP-015-R32
export function CaptureBackAction({ onPress }: { onPress: () => void }) {
	const texts = useTexts().capture.review
	return (
		<CaptureNavAction label={texts.back} onPress={onPress}>
			<SystemSymbol name={SYSTEM_SYMBOL.BACK} tint={colors["primary-foreground"]} fallback={<BackIcon />} />
		</CaptureNavAction>
	)
}
