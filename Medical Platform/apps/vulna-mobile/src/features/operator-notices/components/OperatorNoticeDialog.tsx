import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import type { OperatorNotice } from "../operator-notice"

interface Props {
	notice: OperatorNotice
	isAcknowledging: boolean
	onAcknowledge: () => void
	onShow: (draft: AcquisitionDraftSummary) => void
}

// CAP-015-R18, CAP-015-R20, E57, E75
export function OperatorNoticeDialog({ notice, isAcknowledging, onAcknowledge, onShow }: Props) {
	const texts = useTexts()
	const acknowledgement = {
		label: texts.operatorNotices.acknowledge,
		onPress: onAcknowledge,
		disabled: isAcknowledging,
	}
	const draft = notice.draft
	if (draft === undefined) {
		return <ConfirmDialog title={notice.title} body={notice.body} primary={acknowledgement} />
	}
	return (
		<ConfirmDialog
			title={notice.title}
			body={notice.body}
			primary={{ label: texts.operatorNotices.reminder.show, onPress: () => onShow(draft), disabled: isAcknowledging }}
			secondary={acknowledgement}
		/>
	)
}
