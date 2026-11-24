import { View } from "react-native"
import { OpenRow } from "../../../ui/OpenRow"
import { Detail, Label } from "../../../ui/typography"

interface Props {
	identifier: string
	issuer: string | undefined
	onPress: () => void
}

// CAP-013-R10, CAP-013-R12, CHG-176, E116
export function MatchRow({ identifier, issuer, onPress }: Props) {
	return (
		<OpenRow className="py-row" onPress={onPress}>
			<View className="flex-1 gap-1">
				<Label>{identifier}</Label>
				{issuer === undefined ? null : <Detail>{issuer}</Detail>}
			</View>
		</OpenRow>
	)
}
