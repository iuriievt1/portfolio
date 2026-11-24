import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"

const NO_ACTION = () => undefined

interface Props {
	isClosing: boolean
	onConfirm: (() => void) | undefined
}

// CAP-014-R14, Figma 05 H.1, Vulna / Sheet / Step action
export function ClosingFooter({ isClosing, onConfirm }: Props) {
	const texts = useTexts().capture
	return (
		<View className="px-screen pt-4 pb-safe-gap-or-sheet">
			<Button
				label={isClosing ? texts.closing.closing : texts.summary.confirm}
				onPress={onConfirm ?? NO_ACTION}
				disabled={onConfirm === undefined}
				waiting={isClosing}
			/>
		</View>
	)
}
