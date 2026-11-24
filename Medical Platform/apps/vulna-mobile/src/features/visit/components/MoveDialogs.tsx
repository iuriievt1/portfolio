import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { MOVE, MOVE_REFUSAL, type MoveStep } from "../hooks/use-record-move"
import type { RecordMove } from "../record-move"
import { moveConfirmationTextOf } from "../record-move-text"

interface Props {
	step: MoveStep
	move: RecordMove
	patient: Patient
	onConfirm: () => void
	onDismiss: () => void
	onChooseVisit: () => void
	onLeave: () => void
}

// CAP-014-R25, CAP-014-R26, E25, E70, E115, E117, E118, E129
export function MoveDialogs({ step, move, patient, onConfirm, onDismiss, onChooseVisit, onLeave }: Props) {
	const texts = useTexts()
	const dialog = texts.move
	switch (step.kind) {
		case MOVE.CHOOSING:
		case MOVE.MOVING:
			return null
		case MOVE.CONFIRMING:
			return (
				<ConfirmDialog
					title={dialog.confirm.title}
					body={moveConfirmationTextOf({ record: move.record, draft: move.draft, patient, target: step.target }, texts)}
					primary={{ label: dialog.confirm.move, onPress: onConfirm }}
					secondary={{ label: dialog.confirm.cancel, onPress: onDismiss }}
				/>
			)
		case MOVE.REFUSED:
			return step.refusal === MOVE_REFUSAL.OTHER_PATIENT ? (
				<ConfirmDialog
					title={dialog.refused.title}
					body={dialog.refused.otherPatient}
					secondary={{ label: dialog.close, onPress: onLeave }}
				/>
			) : (
				<ConfirmDialog
					title={dialog.refused.title}
					body={dialog.refused.closedVisit}
					primary={{ label: dialog.refused.chooseVisit, onPress: onChooseVisit }}
					secondary={{ label: dialog.close, onPress: onLeave }}
				/>
			)
		case MOVE.CHANGED:
			return (
				<ConfirmDialog
					title={texts.recordChanged.title}
					body={texts.recordChanged.body}
					secondary={{ label: texts.recordChanged.close, onPress: onLeave }}
				/>
			)
		case MOVE.CLOSED:
			return (
				<ConfirmDialog
					title={dialog.closed.title}
					body={dialog.closed.body}
					secondary={{ label: dialog.close, onPress: onLeave }}
				/>
			)
		case MOVE.FAILED:
			return (
				<RemoteFailureDialog
					failure={step.failure}
					serverErrorHeading={dialog.failed}
					closeLabel={dialog.close}
					onClose={onDismiss}
				/>
			)
		default:
			return step satisfies never
	}
}
