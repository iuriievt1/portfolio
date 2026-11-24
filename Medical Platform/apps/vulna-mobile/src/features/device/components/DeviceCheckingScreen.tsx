import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { Spinner } from "../../../ui/Spinner"
import { Detail, Label } from "../../../ui/typography"

export function DeviceCheckingScreen() {
	const strings = useTexts()
	const texts = strings.device.checking
	return (
		<View className="flex-1 bg-background">
			<View className="flex-space-above" />
			<View className="items-center gap-4 px-screen">
				<Spinner />
				<Label className="self-stretch text-center">{texts.heading}</Label>
				<Detail className="self-stretch text-center">{texts.body}</Detail>
			</View>
			<View className="flex-space-below" />
		</View>
	)
}
