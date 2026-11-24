import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { Detail, Title } from "../../../ui/typography"

interface Props {
	code: string
}

export function ApprovalCode({ code }: Props) {
	const strings = useTexts()
	const texts = strings.device.pending_approval
	return (
		<View className="mt-6 gap-3 rounded-control border border-border bg-card p-6">
			<Detail className="text-center">{texts.codeLabel}</Detail>
			<Title className="text-center">{code}</Title>
		</View>
	)
}
