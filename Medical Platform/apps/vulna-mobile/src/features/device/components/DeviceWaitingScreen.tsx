import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { EntryScreen } from "../../../ui/EntryScreen"
import { TimeIcon } from "../../../ui/icons/TimeIcon"
import { Detail } from "../../../ui/typography"
import { ApprovalCode } from "./ApprovalCode"

interface Props {
	code: string
	checked: boolean
	onCheck: () => void
	onDetails: () => void
}

export function DeviceWaitingScreen({ code, checked, onCheck, onDetails }: Props) {
	const strings = useTexts()
	const texts = strings.device.pending_approval
	return (
		<EntryScreen
			heading={texts.heading}
			body={texts.body}
			action={{ label: checked ? texts.actionAgain : texts.action, onPress: onCheck }}
			secondary={{ label: texts.details, onPress: onDetails }}
		>
			<ApprovalCode code={code} />
			<WaitingNote note={checked ? texts.noteChecked : texts.note} />
		</EntryScreen>
	)
}

function WaitingNote({ note }: { note: string }) {
	return (
		<View className="mt-6 flex-row gap-3">
			<TimeIcon />
			<Detail className="flex-1">{note}</Detail>
		</View>
	)
}
