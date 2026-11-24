import { ADMINISTRATOR_ALERT_KIND, BINARY_RENDITION, BINARY_UPLOAD_RECORD_KIND } from "@ansora/contracts"
import type { AdministratorAlertRow, AdministratorAlertView } from "../types/monitoring.types"

type ClinicalRecordWriteView = AdministratorAlertView["clinical_record_write"]
type BinaryUploadView = AdministratorAlertView["clinical_record_binary_upload"]
type UploadedRecord = Pick<NonNullable<BinaryUploadView>, "record_kind" | "record_id">

// administration.yaml AdministratorAlert, CAP-021-R27, CAP-021-R36, CAP-021-R39, CAP-021-R40, CAP-022-R11
export function administratorAlertViewOf(row: AdministratorAlertRow): AdministratorAlertView {
	return {
		id: row.id,
		kind: row.kind,
		raised_at: row.raised_at.toISOString(),
		is_active: row.resolved_at === null,
		message: row.message,
		audit_record_id: row.audit_id,
		delivery_id: row.delivery_id,
		instance_id: row.delivery_instance_id,
		target_code: row.target_code,
		set_aside_object_count: row.set_aside_object_count,
		clinical_record_write: clinicalRecordWriteOf(row),
		clinical_record_binary_upload: binaryUploadOf(row),
		acknowledgement: acknowledgementOf(row),
	}
}

// CAP-023-R12, CAP-023-S21
function acknowledgementOf(row: AdministratorAlertRow): AdministratorAlertView["acknowledgement"] {
	if (row.acknowledged_at === null || row.acknowledged_by_user_id === null) {
		return null
	}
	return { acknowledged_at: row.acknowledged_at.toISOString(), acknowledged_by_user_id: row.acknowledged_by_user_id }
}

function clinicalRecordWriteOf(row: AdministratorAlertRow): ClinicalRecordWriteView {
	if (
		row.kind !== ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED ||
		row.task_id === null ||
		row.object_kind === null ||
		row.object_id === null
	) {
		return null
	}
	return { task_id: row.task_id, object_kind: row.object_kind, object_id: row.object_id }
}

function uploadedRecordOf(row: AdministratorAlertRow): UploadedRecord | undefined {
	if (row.image_acquisition_id !== null) {
		return { record_kind: BINARY_UPLOAD_RECORD_KIND.ACQUISITION, record_id: row.image_acquisition_id }
	}
	if (row.page_document_id !== null) {
		return { record_kind: BINARY_UPLOAD_RECORD_KIND.DOCUMENT, record_id: row.page_document_id }
	}
	if (row.pdf_document_id !== null) {
		return { record_kind: BINARY_UPLOAD_RECORD_KIND.DOCUMENT, record_id: row.pdf_document_id }
	}
	return undefined
}

// CAP-021-R36, CAP-021-R39, CAP-021-R40
function binaryUploadOf(row: AdministratorAlertRow): BinaryUploadView {
	const record = uploadedRecordOf(row)
	if (record === undefined || row.object_id === null) {
		return null
	}
	switch (row.kind) {
		case ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED:
			return {
				task_id: row.task_id,
				...record,
				file_id: row.object_id,
				...(row.pending_rendition === null ? {} : { rendition: row.pending_rendition }),
			}
		case ADMINISTRATOR_ALERT_KIND.VIEWING_COPY_GENERATION_FAILED:
			return { task_id: null, ...record, file_id: row.object_id, rendition: BINARY_RENDITION.VIEWING_COPY }
		default:
			return null
	}
}
