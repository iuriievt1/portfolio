import { useTexts } from "../../../i18n/language-store"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { NoConnectionIcon } from "../../../ui/icons/NoConnectionIcon"

interface Props {
	onRetry: () => void
}

export function NoConnectionScreen({ onRetry }: Props) {
	const strings = useTexts()
	const texts = strings.device.unreachable
	return (
		<FeedbackScreen
			icon={<NoConnectionIcon />}
			heading={texts.heading}
			body={texts.body}
			note={texts.note}
			action={{ label: texts.action, onPress: onRetry }}
		/>
	)
}
