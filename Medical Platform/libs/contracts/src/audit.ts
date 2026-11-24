import { DISCARD_SITUATION } from "./clinical"
import { DEVICE_EVENT_TYPE } from "./device-events"
import type { components } from "./generated/administration"

// CAP-025-R03, CAP-025-R23
export const AUDIT_EVENT_TYPE = {
	CONFIGURATION_CHANGED: "configuration-changed",
	LOGIN_METHODS_CHANGED: "login-methods-changed",
	DEVICE_REGISTRATION: "device-registration",
	DEVICE_APPROVAL: "device-approval",
	DEVICE_APPROVAL_REJECTED: "device-approval-rejected",
	DEVICE_REVOCATION: "device-revocation",
	// CAP-008-R05, CAP-008-R09, CAP-025-R16
	DEVICE_BLOCKING: "device-blocking",
	// CAP-007-R06, CAP-007-S07, CAP-008-R07
	DEVICE_UNBLOCKING: "device-unblocking",
	DEVICE_ASSIGNED_TO_GROUP: "device-assigned-to-group",
	LOGIN: "login",
	SESSION_REFRESH: "session-refresh",
	SESSION_TERMINATION: "session-termination",
	USER_ROLES_CHANGED: "user-roles-changed",
	USER_DEPARTMENT_CHANGED: "user-department-changed",
	CARD_BINDING_CODE_ISSUED: "card-binding-code-issued",
	CARD_BINDING_CREATED: "card-binding-created",
	QR_CODE_ISSUED: "qr-code-issued",
	QR_CODE_REVOCATION: "qr-code-revocation",
	// CAP-005-R03, CAP-005-R13
	CARD_REVOCATION: "card-revocation",
	// CAP-005-R07, CAP-005-R12
	USER_REVOCATION: "user-revocation",
	AUDIT_EXPORT: "audit-export",
	AUDIT_CHAIN_BROKEN: "audit-chain-broken",
	// CAP-025-R18
	PATIENT_SEARCH: "patient-search",
	// CAP-025-R14, CAP-024-R12
	REGISTRY_SYNC_RUN: "registry-sync-run",
	// CAP-012-S23, ADR-050 bod 10
	CLINICAL_RECORD_BREAK_GLASS_USE: "clinical-record-break-glass-use",
	// CAP-025-R26, CAP-014-R06
	DRAFT_ACQUISITION_CREATED: "draft-acquisition-created",
	// CAP-025-R26, CAP-025-R30
	DRAFT_ACQUISITION_UPDATED: "draft-acquisition-updated",
	// CAP-025-R26, CAP-014-R08
	DRAFT_ACQUISITION_ASSIGNMENT_CHANGED: "draft-acquisition-assignment-changed",
	DRAFT_ACQUISITION_DISCARD: "draft-acquisition-discard",
	// CAP-025-R26, CAP-021-R25
	DRAFT_ACQUISITION_CLOSED: "draft-acquisition-closed",
	// CAP-025-R26, CAP-015-R34
	DRAFT_ACQUISITION_FILE_REPLACED: "draft-acquisition-file-replaced",
	// CAP-025-R26, CAP-015-R33
	DRAFT_ACQUISITION_FILE_ORDER_CHANGED: "draft-acquisition-file-order-changed",
	// CAP-025-R29, CAP-015-R37
	DRAFT_ACQUISITION_CANCELLED: "draft-acquisition-cancelled",
	// CAP-025-R29, CAP-014-R29
	ENCOUNTER_EMPTIED: "encounter-emptied",
	// CAP-025-R28
	PATIENT_RECORD_RELEASE: "patient-record-release",
	// CAP-025-R27
	ENCOUNTER_COMPLETED: "encounter-completed",
	ENCOUNTER_ACTION_REJECTED: "encounter-action-rejected",
	// CAP-025-R30, CAP-017-R02
	FINDING_WOUND_TYPE_CHANGED: "finding-wound-type-changed",
	// CAP-025-R03, CAP-021-R27
	CLINICAL_RECORD_WRITE_REQUEUED: "clinical-record-write-requeued",
	// CAP-025-R03, CAP-015-R19, CAP-015-R20
	DRAFT_DISCARD_CONSENT_GRANTED: "draft-discard-consent-granted",
	// CAP-025-R03, CAP-004-R14
	ACQUISITION_DRAFTS_VIEWED: "acquisition-drafts-viewed",
	// CAP-025-R03, CAP-004-R10
	ACQUISITIONS_VIEWED: "acquisitions-viewed",
	// CAP-023-R07, CAP-023-R12, NAB-437
	DELIVERY_ATTEMPT: "delivery-attempt",
	// CAP-023-R07, CAP-023-R26, datovy-model.md 8
	VERIFICATION_QUERY: "verification-query",
	VERIFICATION_ON_HOLD: "verification-on-hold",
	VERIFICATION_RESUMED: "verification-resumed",
	// CAP-023-R23, CAP-023-R24, datovy-model.md 8
	TARGET_PAUSED: "target-paused",
	TARGET_UNAVAILABLE: "target-unavailable",
	TARGET_RELEASED: "target-released",
	TARGET_RESUMED: "target-resumed",
	// CAP-023-R27, datovy-model.md 8
	TARGET_UNAVAILABILITY_ALERT: "target-unavailability-alert",
	// CAP-023-R28, CAP-023-S24, datovy-model.md 8
	DELIVERY_CLOSED: "delivery-closed",
	// CAP-022-R15, CAP-022-S06, datovy-model.md 8
	TEXT_RECOGNITION_RESTARTED: "text-recognition-restarted",
	// CAP-026-R18, CAP-026-S16, CAP-025-R14
	BUFFER_COPY_DELETION: "buffer-copy-deletion",
	// CAP-026-R19, CAP-026-R20, CAP-026-S17, CAP-026-S20, datovy-model.md 8
	RETENTION_DELETION: "retention-deletion",
	// CAP-026-R14, CAP-026-S07, CAP-026-S08, datovy-model.md 8
	ORPHANED_OBJECT_SET_ASIDE: "orphaned-object-set-aside",
	ORPHANED_OBJECT_DELETION: "orphaned-object-deletion",
	// CAP-028-R15
	ADMINISTRATOR_ALERT_RAISED: "administrator-alert-raised",
	// CAP-023-R12, CHG-189
	ADMINISTRATOR_ALERT_ACKNOWLEDGED: "administrator-alert-acknowledged",
	// CAP-025-R22, CAP-007-R08
	LOCAL_DATA_DELETION: DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION,
	// CAP-025-R22, CAP-001-R32
	AUTHORIZATION_ENDPOINT_MISMATCH: DEVICE_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH,
} as const

export type AuditEventType = (typeof AUDIT_EVENT_TYPE)[keyof typeof AUDIT_EVENT_TYPE]

export const AUDIT_OUTCOME = {
	SUCCESS: "success",
	FAILURE: "failure",
	// CAP-025-R18, CAP-013-R17
	MATCH: "match",
	NO_MATCH: "no_match",
	QUERY_TOO_SHORT: "query_too_short",
	TOO_MANY_MATCHES: "too_many_matches",
	RATE_LIMITED: "rate_limited",
	// CAP-013-R10, CAP-025-R18, CHG-175
	CREATED: "created",
	// CAP-025-R27, CAP-025-R28
	RELEASED: "released",
	COMPLETED: "completed",
	REJECTED: "rejected",
} as const

export type AuditOutcome = (typeof AUDIT_OUTCOME)[keyof typeof AUDIT_OUTCOME]

export type AuditExportFailure = NonNullable<components["schemas"]["AuditExportStatus"]["last_failure"]>

// CAP-025-S03
export const AUDIT_EXPORT_FAILURE = {
	UNREACHABLE: "unreachable",
	TIMED_OUT: "timed_out",
	TLS_REJECTED: "tls_rejected",
	MESSAGE_TOO_LARGE: "message_too_large",
	FAILED: "failed",
} as const satisfies Record<string, AuditExportFailure>

export type AuditExportState = components["schemas"]["AuditExport"]["state"]

export const AUDIT_EXPORT_STATE = {
	QUEUED: "queued",
	DONE: "done",
	FAILED: "failed",
} as const satisfies Record<string, AuditExportState>

export type SystemJob = components["schemas"]["SystemJob"]

// CAP-025-R14
export const SYSTEM_JOB = {
	REGISTRY_SYNC: "registry_sync",
	RETENTION: "retention",
	ORPHAN_CLEANUP: "orphan_cleanup",
	AUDIT_EXPORT: "audit_export",
	// CAP-012-S23
	CLINICAL_RECORD_INSTALLATION: "clinical_record_installation",
	// CAP-021-R27, CAP-028-R15
	CLINICAL_RECORD_WRITE: "clinical_record_write",
	// CAP-026-R16, CAP-028-R15
	DRAFT_REMINDER: "draft_reminder",
	// CAP-028-R15, CAP-028-R22
	DEPENDENCY_MONITORING: "dependency_monitoring",
	// CAP-021-R04, CAP-022-R11, CAP-028-R15
	ASSEMBLY: "assembly",
	// CAP-023-R07, CAP-023-R17, CAP-028-R15
	DELIVERY: "delivery",
} as const satisfies Record<string, SystemJob>

type AuditRecordSchema = components["schemas"]["AuditRecord"]

export type AuditScope = NonNullable<AuditRecordSchema["scope"]>

// CAP-001-R19, CAP-004-R09
export const AUDIT_SCOPE = {
	MOBILE: "mobile",
	ADMINISTRATION: "administration",
} as const satisfies Record<string, AuditScope>

export type AuditSearchMethod = NonNullable<AuditRecordSchema["search_method"]>

// CAP-025-R18, CAP-014-R16, CAP-014-R19, CHG-182
export const AUDIT_SEARCH_METHOD = {
	FULLTEXT: "fulltext",
	CODE: "code",
	NFC_TAG: "nfc_tag",
	IDENTIFIER_SEARCH: "identifier_search",
	SCHEDULED_LIST: "scheduled_list",
	PATIENT_ENCOUNTERS: "patient_encounters",
	RECENT_PATIENTS: "recent_patients",
	UNFINISHED_ENCOUNTERS: "unfinished_encounters",
} as const satisfies Record<string, AuditSearchMethod>

export type ReleaseKind = NonNullable<AuditRecordSchema["release_kind"]>

// CAP-025-R28
export const RELEASE_KIND = {
	ENCOUNTER_CONTENT: "encounter_content",
	PATIENT_DOCUMENTS: "patient_documents",
	ACQUISITION_DETAIL: "acquisition_detail",
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
} as const satisfies Record<string, ReleaseKind>

export type EncounterAction = NonNullable<AuditRecordSchema["encounter_action"]>

// CAP-025-R27
export const ENCOUNTER_ACTION = {
	COMPLETE: "complete",
	CREATE_DRAFT: "create_draft",
	ASSIGN: "assign",
	// Q-150
	CANCEL: "cancel",
} as const satisfies Record<string, EncounterAction>

export type EmptiedBy = NonNullable<AuditRecordSchema["encounter_emptying"]>["emptied_by"]

// CAP-025-R29, CAP-014-R29
export const EMPTIED_BY = {
	DISCARD: "discard",
	CANCELLATION: "cancellation",
	ADMINISTRATOR_CONSENT: "administrator_consent",
	ASSIGNMENT_CHANGE: "assignment_change",
	// Q-150
	ENCOUNTER_CANCELLATION: "encounter_cancellation",
} as const satisfies Record<string, EmptiedBy>

export type AuditDiscardSituation = NonNullable<AuditRecordSchema["discard_situation"]>

// CAP-025-R20, CAP-015-R17, CAP-015-R19
export const AUDIT_DISCARD_SITUATION = {
	...DISCARD_SITUATION,
	ADMINISTRATOR_CONSENT: "administrator_consent",
} as const satisfies Record<string, AuditDiscardSituation>

export type RegistrySyncOutcome = NonNullable<AuditRecordSchema["registry_sync_run"]>["outcome"]

// CAP-025-R14, CAP-024-R08
export const REGISTRY_SYNC_OUTCOME = {
	COMPLETE: "complete",
	INCOMPLETE: "incomplete",
} as const satisfies Record<string, RegistrySyncOutcome>

export type SyncStateValue = components["schemas"]["SyncState"]["state"]

// NAB-347
export const SYNC_STATE = {
	RUNNING: "running",
	WAITING: "waiting",
	FAILED: "failed",
	INCOMPLETE_OUTCOME: "incomplete_outcome",
} as const satisfies Record<string, SyncStateValue>

export type AuditExportStage = NonNullable<AuditRecordSchema["audit_export"]>["stage"]

// NAB-442
export const AUDIT_EXPORT_STAGE = {
	REQUESTED: "requested",
	DOWNLOADED: "downloaded",
} as const satisfies Record<string, AuditExportStage>
