import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import { DEPARTMENT, ENCOUNTER, PATIENT, USER } from "../../encounter/__tests__/encounter-fixtures"
import type { RecordFileRow, StoredFileRow } from "../types/image.types"

export const IMAGE = "c0000000-0000-4000-8000-000000000001"
export const ACQUISITION = "a0000000-0000-4000-8000-000000000010"
export const ORIGINAL_OBJECT = "b0000000-0000-4000-8000-000000000001"
export const THUMBNAIL_OBJECT = "b0000000-0000-4000-8000-000000000002"
export const VIEWING_COPY_OBJECT = "b0000000-0000-4000-8000-000000000003"
export const STORED_ORIGINAL = "medplum-binary-original"
export const STORED_THUMBNAIL = "medplum-binary-thumbnail"
export const STORED_VIEWING_COPY = "medplum-binary-viewing-copy"
export const BUFFER_CLEANUP_MOMENT = new Date("2026-10-01T00:00:00Z")

export function storedFile(overrides: Partial<StoredFileRow> = {}): StoredFileRow {
	return {
		id: IMAGE,
		acquisition_id: ACQUISITION,
		patient_id: PATIENT,
		encounter_id: ENCOUNTER,
		state: ACQUISITION_STATE.RECEIVED,
		operator_user_id: USER,
		department_id: DEPARTMENT,
		status: FILE_STATUS.RECEIVED,
		binary_object_id: ORIGINAL_OBJECT,
		buffer_deleted_at: null,
		clinical_record_binary_id: STORED_ORIGINAL,
		thumbnail_binary_object_id: THUMBNAIL_OBJECT,
		thumbnail_buffer_deleted_at: null,
		thumbnail_clinical_record_binary_id: STORED_THUMBNAIL,
		viewing_copy_binary_object_id: null,
		viewing_copy_buffer_deleted_at: null,
		viewing_copy_clinical_record_binary_id: null,
		...overrides,
	}
}

export function recordFile(overrides: Partial<RecordFileRow> = {}): RecordFileRow {
	return {
		id: IMAGE,
		acquisition_id: ACQUISITION,
		sequence: 1,
		edit_kind: null,
		has_thumbnail: true,
		is_available: true,
		has_viewing_copy: false,
		...overrides,
	}
}
