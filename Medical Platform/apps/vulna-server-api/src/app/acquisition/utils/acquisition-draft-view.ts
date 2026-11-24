import { ACQUISITION_STATE_VALUE } from "@ansora/contracts"
import { isReminderDue } from "@ansora/vulna-domain"
import type { EncounterView } from "../../encounter/types/encounter.types"
import { assessmentViewOf } from "../../finding/utils/assessment-view"
import type { FoundPatient, PatientView } from "../../registry/types/registry.types"
import { patientViewOf } from "../../registry/utils/patient-view"
import type {
	AcquisitionDraftSummaryView,
	AcquisitionDraftView,
	AcquisitionReceiptView,
	AcquisitionRow,
	DraftContent,
	DraftReminder,
	DraftWound,
} from "../types/acquisition.types"
import type { FileCountRow } from "../types/acquisition-file.types"

// clinical-workflow.yaml AcquisitionReceipt
export function acquisitionReceiptOf(row: AcquisitionRow): AcquisitionReceiptView {
	return {
		acquisition_id: row.id,
		idempotency_key: row.idempotency_key,
		state: ACQUISITION_STATE_VALUE.DRAFT,
		encounter_id: row.encounter_id,
	}
}

// clinical-workflow.yaml AcquisitionReceipt, CAP-014-R14, CAP-021-R29
export function closedReceiptOf(row: AcquisitionRow): AcquisitionReceiptView {
	return {
		acquisition_id: row.id,
		idempotency_key: row.idempotency_key,
		state: ACQUISITION_STATE_VALUE.RECEIVED,
		encounter_id: row.encounter_id,
		finding_id: row.finding_id,
	}
}

// clinical-workflow.yaml AcquisitionDraft, CAP-015-R15, CAP-015-R35, CAP-017-R02, CAP-018-R15
export function acquisitionDraftViewOf(
	row: AcquisitionRow,
	patient: PatientView,
	encounter: EncounterView,
	wound: DraftWound,
	content: DraftContent,
): AcquisitionDraftView {
	const view: AcquisitionDraftView = {
		acquisition_id: row.id,
		idempotency_key: row.idempotency_key,
		state: ACQUISITION_STATE_VALUE.DRAFT,
		kind: row.kind,
		patient,
		encounter,
		finding_id: row.finding_id,
		wound_type_code: wound.woundTypeCode,
		operator_user_id: row.operator_user_id,
		started_at: row.started_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
		version: row.version,
		files: content.files,
	}
	if (content.documentTitle !== undefined) {
		view.document_title = content.documentTitle
	}
	if (wound.bodySite !== undefined) {
		view.body_site = wound.bodySite
	}
	if (wound.assessment !== undefined) {
		view.assessment = assessmentViewOf(wound.assessment)
	}
	return view
}

// clinical-workflow.yaml AcquisitionDraftSummary, CAP-015-R29, CAP-015-R36
export function acquisitionDraftSummaryOf(
	row: AcquisitionRow,
	patient: FoundPatient,
	files: Pick<FileCountRow, "received" | "rejected">,
	reminder: DraftReminder,
): AcquisitionDraftSummaryView {
	return {
		acquisition_id: row.id,
		kind: row.kind,
		patient: patientViewOf(patient),
		encounter_id: row.encounter_id,
		file_count: files.received,
		started_at: row.started_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
		reminder_due: isReminderDue(row.updated_at, reminder.now, reminder.reminderSeconds),
		rejected_file_count: files.rejected,
	}
}
