import { useTexts } from "../../../i18n/language-store"
import { ENTRY_OFFSET } from "../../../ui/EntryLayout"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { LockKeyIcon } from "../../../ui/icons/LockKeyIcon"

interface Props {
	onChangeAccount: () => void
}

// CAP-003-S04
export function NoRoleScreen({ onChangeAccount }: Props) {
	const strings = useTexts()
	const texts = strings.access.noRole
	return (
		<FeedbackScreen
			icon={<LockKeyIcon />}
			heading={texts.heading}
			body={texts.body}
			action={{ label: strings.unlock.changeUser, onPress: onChangeAccount }}
			offset={ENTRY_OFFSET.FEEDBACK}
		/>
	)
}
