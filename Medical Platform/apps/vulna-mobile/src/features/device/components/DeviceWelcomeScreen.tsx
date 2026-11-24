import { useTexts } from "../../../i18n/language-store"
import { EntryScreen } from "../../../ui/EntryScreen"
import { Detail } from "../../../ui/typography"

interface Props {
	onRegister: () => void
}

export function DeviceWelcomeScreen({ onRegister }: Props) {
	const strings = useTexts()
	const texts = strings.device.unregistered
	return (
		<EntryScreen heading={texts.heading} body={texts.body} action={{ label: texts.action, onPress: onRegister }}>
			<Detail className="pt-6">{texts.note}</Detail>
		</EntryScreen>
	)
}
