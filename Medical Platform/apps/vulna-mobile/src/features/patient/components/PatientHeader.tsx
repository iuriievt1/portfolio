import type { ReactNode } from "react"
import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BrandHeader, HEADER_INSET } from "../../../ui/Brand"
import { GlassAction } from "../../../ui/GlassAction"
import { BackIcon } from "../../../ui/icons/BackIcon"
import { SYSTEM_SYMBOL, SystemSymbol } from "../../../ui/SystemSymbol"
import { Caption, Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	title: string
	subtitle: string | undefined
	numberOfLines?: number
	trailing?: ReactNode
	onBack: () => void
}

// CAP-013-R09, CAP-013-R19, E98, Vulna / Native / Patient navigation — leading
export function PatientHeader({ title, subtitle, numberOfLines, trailing, onBack }: Props) {
	const texts = useTexts()
	return (
		<BrandHeader inset={HEADER_INSET.PATIENT}>
			<GlassAction label={texts.patient.back} onPress={onBack}>
				<SystemSymbol name={SYSTEM_SYMBOL.BACK} fallback={<BackIcon />} />
			</GlassAction>
			<View className="flex-1">
				<Label
					className="text-compact"
					tone={TEXT_TONE.ON_BRAND}
					accessibilityRole="header"
					numberOfLines={numberOfLines}
				>
					{title}
				</Label>
				{subtitle === undefined ? null : (
					<Caption className="font-normal" tone={TEXT_TONE.ON_BRAND} numberOfLines={numberOfLines}>
						{subtitle}
					</Caption>
				)}
			</View>
			{trailing}
		</BrandHeader>
	)
}
