import { Text, View } from "react-native"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"

interface Props {
	day: string
	weekday: string
}

// Vulna / Patient / Visit history row
export function DateTile({ day, weekday }: Props) {
	return (
		<View className="h-11 w-11 items-center justify-center rounded-xl bg-date-tile">
			<Text className="font-semibold text-primary text-tile-day" maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
				{day}
			</Text>
			<Text className="font-medium text-primary text-tile-weekday" maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
				{weekday}
			</Text>
		</View>
	)
}
