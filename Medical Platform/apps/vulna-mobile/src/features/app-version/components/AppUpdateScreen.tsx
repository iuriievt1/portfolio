import { useTexts } from "../../../i18n/language-store"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { WarningIcon } from "../../../ui/icons/WarningIcon"
import { useVersionNote } from "../hooks/use-version-note"

// CAP-012-R24, E34
export function AppUpdateScreen() {
	const texts = useTexts().appUpdate
	const versionNote = useVersionNote()
	return <FeedbackScreen icon={<WarningIcon />} heading={texts.heading} body={texts.body} note={versionNote} />
}
