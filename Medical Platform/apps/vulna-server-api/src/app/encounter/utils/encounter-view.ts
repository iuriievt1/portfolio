import { ACQUISITION_STATE_VALUE, type MissingStep } from "@ansora/contracts"
import {
	ACQUISITION_STATE,
	acceptsNewRecords,
	type ClinicalSteps,
	type DraftProgress,
	INSTANCE_TIME_ZONE,
	momentOfDayTime,
	nextMissingStepOf,
} from "@ansora/vulna-domain"
import type { AcquisitionRow, EncounterAcquisitionItemView } from "../../acquisition/types/acquisition.types"
import { NO_FILES } from "../constants/encounter.constants"
import type { EncounterRow, EncounterView, RecordProgress } from "../types/encounter.types"

// clinical-workflow.yaml Encounter
export function encounterViewOf(row: EncounterRow, acquisitionCount: number, today: string): EncounterView {
	return {
		encounter_id: row.id,
		patient_id: row.patient_id,
		date: row.date,
		source: row.source,
		status: row.status,
		accepts_new_records: acceptsNewRecords(row, today),
		started_at: row.started_at?.toISOString() ?? null,
		completed_at: row.completed_at?.toISOString() ?? null,
		completed_by: row.completed_by,
		acquisition_count: acquisitionCount,
		scheduled_time:
			row.scheduled_time === null ? null : momentOfDayTime(row.date, row.scheduled_time, INSTANCE_TIME_ZONE),
		study_instance_uid: row.study_instance_uid,
		accession_number: row.accession_number,
	}
}

// CAP-014-R22, CAP-015-R31, CAP-015-R35, CAP-015-R36, CAP-018-R15, CAP-017-R16
export function recordMissingStepOf(row: AcquisitionRow, progress: RecordProgress, steps: ClinicalSteps): MissingStep {
	const draftProgress: DraftProgress = {
		kind: row.kind,
		fileCount: progress.received_count + progress.announced_count,
		hasFinding: row.finding_id !== null,
		hasBodySite: row.finding_id !== null,
		hasWoundType: progress.has_wound_type,
		hasHealingPhase: progress.has_healing_phase,
		hasDocumentTitle: progress.has_document_title,
	}
	return nextMissingStepOf(draftProgress, steps, progress.announced_count + progress.rejected_count)
}

// clinical-workflow.yaml EncounterAcquisitionItem, CAP-014-R22, CAP-019-R28
export function encounterAcquisitionItemOf(
	row: AcquisitionRow,
	progress: RecordProgress,
	steps: ClinicalSteps,
): EncounterAcquisitionItemView {
	if (row.state !== ACQUISITION_STATE.DRAFT) {
		return {
			acquisition_id: row.id,
			kind: row.kind,
			state: ACQUISITION_STATE_VALUE.RECEIVED,
			file_count: progress.received_count,
			updated_at: row.updated_at.toISOString(),
			missing_step: null,
			missing_file_count: NO_FILES,
			rejected_file_count: NO_FILES,
			files_on_other_device: false,
		}
	}
	return {
		acquisition_id: row.id,
		kind: row.kind,
		state: ACQUISITION_STATE_VALUE.DRAFT,
		file_count: progress.received_count,
		updated_at: row.updated_at.toISOString(),
		missing_step: recordMissingStepOf(row, progress, steps),
		missing_file_count: progress.announced_count,
		rejected_file_count: progress.rejected_count,
		files_on_other_device: progress.files_on_other_device,
	}
}
