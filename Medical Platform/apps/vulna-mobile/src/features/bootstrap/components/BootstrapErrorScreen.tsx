import type { AddressName, PinningName } from "@ansora/core-mobile"
import { Text, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"

interface Props {
	missing: readonly (AddressName | PinningName)[]
}

export function BootstrapErrorScreen({ missing }: Props) {
	const strings = useTexts()
	return (
		<View className="flex-1 items-center justify-center gap-2 p-6">
			<Text className="text-lg font-semibold">{strings.bootstrap.heading}</Text>
			{missing.map((name) => (
				<Text key={name}>{strings.bootstrap.missing[name]}</Text>
			))}
			<Text>{strings.bootstrap.contactIt}</Text>
		</View>
	)
}
