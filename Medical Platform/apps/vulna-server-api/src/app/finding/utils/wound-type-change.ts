import { randomUUID } from "node:crypto"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, codeListSetVersionText } from "@ansora/core-server"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import type { WoundTypeChangeRecord } from "../../clinical-record/types/clinical-record.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import type { FindingRow } from "../types/finding.types"
import type { NewWoundTypeChange } from "../types/finding-history.types"

// CAP-020-R21, CAP-020-R19
export function woundTypeChangeOf(
	finding: FindingRow,
	code: string,
	codeListVersion: number,
	userId: string,
	now: Date,
): NewWoundTypeChange {
	if (finding.wound_type_code === null || finding.wound_type_code_list_version === null) {
		throw new Error(`the finding ${finding.id} has no wound type to change`)
	}
	return {
		id: randomUUID(),
		findingId: finding.id,
		changedAt: now,
		changedBy: userId,
		previousCode: finding.wound_type_code,
		previousCodeListVersion: finding.wound_type_code_list_version,
		code,
		codeListVersion,
	}
}

// CAP-020-R21, ADR-054 bod 3
export function woundTypeChangeRecordOf(finding: FindingRow, change: NewWoundTypeChange): WoundTypeChangeRecord {
	return {
		changeId: change.id,
		findingId: finding.id,
		patientId: finding.patient_id,
		departmentId: finding.department_id,
		woundTypeCode: change.code,
		changedAt: change.changedAt,
		changedBy: change.changedBy,
	}
}

// CAP-025-R30, CAP-025-R23
export function woundTypeChangeAuditOf(patient: FoundPatient, change: NewWoundTypeChange): UserAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.FINDING_WOUND_TYPE_CHANGED,
		objectId: change.findingId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: withPatientSubject(patient, {
			wound_type_change: {
				finding_id: change.findingId,
				previous_wound_type_code: change.previousCode,
				wound_type_code: change.code,
				code_list_version: codeListSetVersionText(change.codeListVersion),
			},
		}),
	}
}
