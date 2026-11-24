import { ACQUISITION_KIND } from "@ansora/contracts"
import type { AcquisitionDraft } from "../../api/acquisitions"
import type { Encounter, EncounterAcquisitionItem } from "../../api/encounters"
import type { Patient } from "../../api/patients"
import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import { patientNumberOf } from "../patient/patient-identity"
import { recordFilesOf, recordTitleOf, visitWhenOf, visitWhenTextOf } from "./visit-view"

export const MOVE_TARGET = {
	EXISTING: "existing",
	NEW: "new",
} as const

// CAP-014-R06, CAP-014-R25
export type MoveTarget =
	| { kind: typeof MOVE_TARGET.EXISTING; encounter: Encounter }
	| { kind: typeof MOVE_TARGET.NEW; encounterKey: string }

export interface MoveConfirmation {
	record: EncounterAcquisitionItem
	draft: AcquisitionDraft
	patient: Patient
	target: MoveTarget
}

export function isSamePatient(draft: AcquisitionDraft, patient: Patient): boolean {
	return draft.patient.patient_id === patient.patient_id
}

function visitTextOf(encounter: Encounter | undefined, texts: Texts): string {
	const confirm = texts.move.confirm
	if (encounter === undefined) {
		return confirm.newVisit
	}
	const when = visitWhenTextOf(visitWhenOf(encounter, new Date(), texts.language), texts)
	return fillText(confirm.visit, { when }, texts.language)
}

function targetEncounterOf(target: MoveTarget): Encounter | undefined {
	return target.kind === MOVE_TARGET.EXISTING ? target.encounter : undefined
}

// CAP-014-R25, CAP-014-R26, CHG-176, E117
export function moveConfirmationTextOf(move: MoveConfirmation, texts: Texts): string {
	const confirm = texts.move.confirm
	const language = texts.language
	const { record, draft, patient } = move
	const values = { record: recordTitleOf(record, texts), files: recordFilesOf(record, texts) }
	const target = visitTextOf(targetEncounterOf(move.target), texts)
	if (isSamePatient(draft, patient)) {
		return fillText(confirm.otherVisit, { ...values, from: visitTextOf(draft.encounter, texts), to: target }, language)
	}
	const moved = fillText(
		confirm.otherPatient,
		{
			...values,
			from: patientNumberOf(draft.patient),
			to: fillText(confirm.patientAtVisit, { patient: patientNumberOf(patient), visit: target }, language),
		},
		language,
	)
	return record.kind === ACQUISITION_KIND.PHOTO ? `${moved} ${confirm.woundAgain}` : moved
}
