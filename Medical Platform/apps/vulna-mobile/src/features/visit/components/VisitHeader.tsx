import type { ReactNode } from "react"
import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { Label } from "../../../ui/typography"
import { PatientLine } from "../../patient/components/PatientLine"

interface Props {
	title: string
	patient: Patient
	leading: ReactNode | undefined
	trailing: ReactNode | undefined
}

// CAP-013-R09, E100, E101, E117, HIG-09
export function VisitHeader({ title, patient, leading, trailing }: Props) {
	return (
		<View className="items-center px-4 pt-4 pb-2.5 android:pt-safe-offset-4">
			<View className="min-h-11 w-full items-center justify-center px-14">
				<Label
					className="self-stretch text-center"
					accessibilityRole="header"
					numberOfLines={1}
					maxFontSizeMultiplier={CONTROL_FONT_SCALE}
				>
					{title}
				</Label>
				<PatientLine patient={patient} />
				{leading === undefined ? null : <View className="absolute top-0 left-0">{leading}</View>}
				{trailing === undefined ? null : <View className="absolute top-0 right-0">{trailing}</View>}
			</View>
		</View>
	)
}
