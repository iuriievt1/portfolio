import { useRouter } from "expo-router"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { openOwnDraft, openOwnDraftSummary } from "../../drafts/open-own-draft"
import { useQueueNotices } from "../hooks/use-queue-notices"
import { isQueueLossOf, NOTICE_ACTION, type NoticeAction, queueNoticeViewOf } from "../queue-notice-view"

interface Props {
	drafts: readonly AcquisitionDraftSummary[]
	isHidden: boolean
}

function openingOf(action: NoticeAction, draft: AcquisitionDraftSummary) {
	return action === NOTICE_ACTION.OPEN_SUMMARY ? openOwnDraftSummary(draft) : openOwnDraft(draft)
}

// CAP-019-R25, CAP-019-R29, CAP-019-S10, CAP-009-S05, E27, E55, E113, E114, Q-076
export function QueueNotices({ drafts, isHidden }: Props) {
	const texts = useTexts()
	const router = useRouter()
	const notices = useQueueNotices()
	const notice = notices.current
	if (isHidden) {
		return null
	}
	if (isQueueLossOf(notices.lostAt, drafts)) {
		return (
			<ConfirmDialog
				title={texts.queueNotices.storageLost.title}
				body={texts.queueNotices.storageLost.body}
				primary={{ label: texts.operatorNotices.acknowledge, onPress: notices.acknowledgeLostQueue }}
			/>
		)
	}
	if (notice === undefined) {
		return null
	}
	const view = queueNoticeViewOf(notice, texts)
	const acknowledgement = { label: texts.operatorNotices.acknowledge, onPress: () => notices.acknowledge(notice.id) }
	const draft = drafts.find((candidate) => candidate.acquisition_id === notice.acquisitionId)
	if (draft === undefined || view.action === NOTICE_ACTION.NONE) {
		return <ConfirmDialog title={view.title} body={view.body} primary={acknowledgement} />
	}
	const open = () => {
		notices.acknowledge(notice.id)
		router.push(openingOf(view.action, draft))
	}
	const openLabel =
		view.action === NOTICE_ACTION.OPEN_SUMMARY ? texts.queueNotices.openSummary : texts.queueNotices.openRecord
	return (
		<ConfirmDialog
			title={view.title}
			body={view.body}
			primary={{ label: openLabel, onPress: open }}
			secondary={acknowledgement}
		/>
	)
}
