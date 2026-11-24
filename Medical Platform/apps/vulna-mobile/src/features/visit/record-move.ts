import type { AcquisitionDraft } from "../../api/acquisitions"
import type { EncounterAcquisitionItem } from "../../api/encounters"
import type { Patient } from "../../api/patients"
import type { OpenedVisit } from "./opened-visit"

// CAP-014-R25
export interface RecordMove {
	source: OpenedVisit
	record: EncounterAcquisitionItem
	draft: AcquisitionDraft
	target: Patient | undefined
}

let move: RecordMove | undefined

export function beginRecordMove(start: Omit<RecordMove, "target">): void {
	move = { ...start, target: undefined }
}

export function chooseMoveTarget(patient: Patient): void {
	if (move !== undefined) {
		move = { ...move, target: patient }
	}
}

export function recordMove(): RecordMove | undefined {
	return move
}

export function forgetRecordMove(): void {
	move = undefined
}
