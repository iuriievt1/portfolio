import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { SPINNER_SIZE, Spinner } from "../../../ui/Spinner"
import { MORE, type More } from "../hooks/use-paged-content"

interface Props {
	more: More
	onRetry: () => void
}

// ADR-012, CAP-002-R17
export function MoreFooter({ more, onRetry }: Props) {
	const texts = useTexts().remote
	switch (more) {
		case MORE.LOADING:
			return (
				<View className="items-center py-4">
					<Spinner size={SPINNER_SIZE.CONTROL} />
				</View>
			)
		case MORE.FAILED:
			return (
				<View className="px-screen py-4">
					<Button label={texts.retry} style={BUTTON_STYLE.SECONDARY} onPress={onRetry} />
				</View>
			)
		case MORE.AVAILABLE:
		case MORE.NONE:
			return null
		default:
			return more satisfies never
	}
}
