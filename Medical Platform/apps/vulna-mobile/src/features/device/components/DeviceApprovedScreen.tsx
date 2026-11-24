import { useTexts } from "../../../i18n/language-store"
import { EntryScreen } from "../../../ui/EntryScreen"

interface Props {
	onSignIn: () => void
	waiting?: boolean
}

export function DeviceApprovedScreen({ onSignIn, waiting = false }: Props) {
	const strings = useTexts()
	const texts = strings.device.approved
	return (
		<EntryScreen
			heading={texts.heading}
			body={texts.body}
			action={{ label: texts.action, onPress: onSignIn, waiting }}
		/>
	)
}
