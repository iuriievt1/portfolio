import type { EncounterAcquisitionItem } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { countText, fillText } from "../../../utils/fill-text"
import { patientNumberOf } from "../../patient/patient-identity"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { type QueuedRecordMarks, recordNoteOf } from "../../upload/record-note"
import { FINISH_STEP, type FinishStep } from "../hooks/use-visit"
import { missingStepTextOf, recordTitleOf, type VisitWhen, visitWhenTextOf } from "../visit-view"

interface Props {
	step: FinishStep
	patient: Patient
	when: VisitWhen
	records: readonly EncounterAcquisitionItem[]
	marks: QueuedRecordMarks
	onConfirm: () => void
	onDismiss: () => void
}

// CAP-014-R20, CAP-019-R29, CHG-176, E102 to E104, E70, E129
export function FinishDialogs({ step, patient, when, records, marks, onConfirm, onDismiss }: Props) {
	const texts = useTexts()
	const visit = texts.visit
	switch (step.kind) {
		case FINISH_STEP.IDLE:
		case FINISH_STEP.FINISHING:
			return null
		case FINISH_STEP.CONFIRMING: {
			const count = records.length
			const body = fillText(
				visit.confirmFinish.body,
				{
					patient: patientNumberOf(patient),
					when: visitWhenTextOf(when, texts),
					records: countText(texts.patient.records, count, texts.language),
				},
				texts.language,
			)
			return (
				<ConfirmDialog
					title={visit.confirmFinish.title}
					body={body}
					primary={{ label: visit.confirmFinish.confirm, onPress: onConfirm }}
					secondary={{ label: visit.confirmFinish.cancel, onPress: onDismiss }}
				/>
			)
		}
		case FINISH_STEP.OWN_DRAFT:
			return (
				<ConfirmDialog
					title={visit.ownDraft.title}
					body={fillText(
						visit.ownDraft.body,
						{
							record: recordTitleOf(step.draft, texts),
							missing: missingStepTextOf(step.draft, texts, recordNoteOf(step.draft, marks)) ?? visit.missing.unknown,
						},
						texts.language,
					)}
					secondary={{ label: visit.ownDraft.close, onPress: onDismiss }}
				/>
			)
		case FINISH_STEP.OTHERS_WORKING:
			return (
				<ConfirmDialog
					title={visit.othersWorking.title}
					body={visit.othersWorking.body}
					secondary={{ label: visit.othersWorking.close, onPress: onDismiss }}
				/>
			)
		case FINISH_STEP.FAILED:
			return (
				<RemoteFailureDialog
					failure={step.failure}
					serverErrorHeading={visit.finishFailed}
					closeLabel={visit.confirmFinish.cancel}
					onClose={onDismiss}
				/>
			)
		default:
			return step satisfies never
	}
}
