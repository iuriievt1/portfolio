import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { countText } from "../../../utils/fill-text"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { CLOSED_VISIT, DRAFT_CREATION, type DraftCreation } from "../hooks/use-draft-creation"

interface Props {
	creation: DraftCreation
	onDismiss: () => void
	onShowDrafts: () => void
	onNewVisit: () => void
	onVisitCompleted: () => void
	onVisitClosed: () => void
}

// CAP-015-R18, CAP-015-S14, CAP-014-R21, CAP-014-R29, CAP-014-R30, CAP-002-R17, ADR-054 bod 5, E56, E105, E121
export function DraftCreationDialogs({
	creation,
	onDismiss,
	onShowDrafts,
	onNewVisit,
	onVisitCompleted,
	onVisitClosed,
}: Props) {
	const texts = useTexts()
	const draft = texts.visit.draft
	const newVisit = { label: draft.newVisit, onPress: onNewVisit }
	switch (creation.kind) {
		case DRAFT_CREATION.IDLE:
		case DRAFT_CREATION.CREATING:
			return null
		case DRAFT_CREATION.LIMIT_REACHED:
			return (
				<ConfirmDialog
					title={draft.limit.title}
					body={
						creation.limit === undefined
							? draft.limit.bodyWithoutCount
							: countText(draft.limit.body, creation.limit, texts.language)
					}
					primary={{ label: draft.limit.show, onPress: onShowDrafts }}
					secondary={{ label: draft.close, onPress: onDismiss }}
				/>
			)
		case DRAFT_CREATION.VISIT_COMPLETED:
			return (
				<ConfirmDialog
					title={draft.completed.title}
					body={draft.completed.body}
					primary={newVisit}
					secondary={{ label: draft.close, onPress: onVisitCompleted }}
				/>
			)
		case DRAFT_CREATION.VISIT_CLOSED:
			return (
				<ConfirmDialog
					title={draft.closed.title}
					body={creation.reason === CLOSED_VISIT.CANCELLED ? draft.closed.cancelled : draft.closed.earlier}
					primary={newVisit}
					secondary={{ label: draft.close, onPress: onVisitClosed }}
				/>
			)
		case DRAFT_CREATION.FAILED:
			return (
				<RemoteFailureDialog
					failure={creation.failure}
					serverErrorHeading={draft.failed}
					closeLabel={draft.close}
					onClose={onDismiss}
				/>
			)
		default:
			return creation satisfies never
	}
}
