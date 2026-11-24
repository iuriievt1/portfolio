import { SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import { RETENTION_IDENTITY } from "../constants/retention.constants"
import type { BufferCopyRow, RetainedFileRow } from "../types/retention.types"

// CAP-026-R18, CAP-026-S16, CAP-025-R14, datovy-model.md 8
export function bufferCopyDeletionEventOf(copy: BufferCopyRow): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.BUFFER_COPY_DELETION,
		systemJob: SYSTEM_JOB.RETENTION,
		objectId: copy.file_id ?? copy.artifact_id ?? undefined,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			binary_object_id: copy.binary_object_id,
			rendition: copy.rendition,
			file_kind: copy.file_kind,
			file_id: copy.file_id,
			artifact_id: copy.artifact_id,
			acquisition_id: copy.acquisition_id,
			retention_anchor: copy.retention_anchor.toISOString(),
		},
	}
}

// CAP-026-R19, CAP-026-R20, CAP-026-S17, CAP-026-S20, datovy-model.md 8
export function retentionDeletionEventOf(file: RetainedFileRow): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.RETENTION_DELETION,
		systemJob: SYSTEM_JOB.RETENTION,
		objectId: file.file_id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			binary_object_id: file.binary_object_id,
			clinical_record_binary_id: file.clinical_record_binary_id,
			rendition: file.rendition,
			file_kind: file.file_kind,
			file_id: file.file_id,
			acquisition_id: file.acquisition_id,
			retention_anchor: file.retention_anchor.toISOString(),
			identity: RETENTION_IDENTITY,
		},
	}
}
