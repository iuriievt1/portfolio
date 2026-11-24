import type { AcquisitionDraft } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { DRAFT_DISCARD, type DraftDiscard } from "../draft-discard"

interface Props {
	discard: DraftDiscard
	onConfirm: (draft: AcquisitionDraft) => void
	onDismiss: () => void
}

// CAP-015-R17, CAP-015-S44, CAP-021-R32, ADR-038, E40, E70, E115
export function DraftDiscardDialogs({ discard, onConfirm, onDismiss }: Props) {
	const texts = useTexts()
	const confirmation = texts.drafts.discard
	switch (discard.kind) {
		case DRAFT_DISCARD.IDLE:
		case DRAFT_DISCARD.PREPARING:
			return null
		case DRAFT_DISCARD.CONFIRMING:
		case DRAFT_DISCARD.DISCARDING: {
			const { draft } = discard
			const isDiscarding = discard.kind === DRAFT_DISCARD.DISCARDING
			return (
				<ConfirmDialog
					title={confirmation.title}
					body={confirmation.body[draft.kind]}
					destructive={{ label: confirmation.confirm, onPress: () => onConfirm(draft), disabled: isDiscarding }}
					secondary={{ label: confirmation.cancel, onPress: onDismiss, disabled: isDiscarding }}
				/>
			)
		}
		case DRAFT_DISCARD.CHANGED:
			return (
				<ConfirmDialog
					title={texts.recordChanged.title}
					body={texts.recordChanged.body}
					secondary={{ label: texts.recordChanged.close, onPress: onDismiss }}
				/>
			)
		case DRAFT_DISCARD.FAILED:
			return (
				<RemoteFailureDialog
					failure={discard.failure}
					serverErrorHeading={confirmation.failed}
					closeLabel={texts.drafts.close}
					onClose={onDismiss}
				/>
			)
		default:
			return discard satisfies never
	}
}
