import {
	AUDIT_DISCARD_SITUATION,
	AUDIT_EXPORT_STAGE,
	AUDIT_SCOPE,
	AUDIT_SEARCH_METHOD,
	CLINICAL_RECORD_WRITE_OBJECT_KIND,
	EMPTIED_BY,
	ENCOUNTER_ACTION,
	ENCOUNTER_STATUS,
	LOCAL_DATA_DELETION_REASON,
	LOGIN_METHOD,
	REGISTRY_SYNC_OUTCOME,
	RELEASE_KIND,
	ROLE,
} from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	DEPARTMENT_ORIGIN,
	DEVICE_STATE,
	type JsonObject,
	type JsonValue,
	LOGIN_METHOD_SOURCE,
	QUICK_LOGIN_METHODS,
	ROLE_ORIGIN,
} from "@ansora/core-server"
import type { AuditSearchRow } from "../types/audit.types"
import type { AuditRecordView } from "../types/audit-administration.types"

type EventFields = Partial<
	Pick<
		AuditRecordView,
		| "target_user_id"
		| "target_device_id"
		| "scope"
		| "login_method"
		| "reason"
		| "configuration_version"
		| "login_methods_change"
		| "device_group_change"
		| "previous_device_state"
		| "role_change"
		| "department_change"
		| "code_expires_at"
		| "card_id"
		| "qr_code_id"
		| "audit_export"
		| "audit_chain_check"
		| "search_method"
		| "released_item_count"
		| "release_kind"
		| "encounter_id"
		| "acquisition_id"
		| "delivery_id"
		| "delivery_instance_id"
		| "binary_object_id"
		| "encounter_action"
		| "encounter_completion"
		| "encounter_emptying"
		| "assignment_change"
		| "operator_user_id"
		| "patient_identifier"
		| "patient_identifiers"
		| "draft_discard_consent_id"
		| "discard_situation"
		| "discarded_file_count"
		| "registry_sync_run"
		| "wound_type_change"
		| "originated_on_device_at"
		| "lost_items"
		| "details"
	>
>

type Overrides = NonNullable<AuditRecordView["login_methods_change"]>["previous"]

const SCOPES = Object.values(AUDIT_SCOPE)
const LOGIN_METHODS = Object.values(LOGIN_METHOD)
const ROLES = Object.values(ROLE)
const DEVICE_STATES = Object.values(DEVICE_STATE)
const ROLE_ORIGINS = Object.values(ROLE_ORIGIN)
const DEPARTMENT_ORIGINS = Object.values(DEPARTMENT_ORIGIN)
const EXPORT_STAGES = Object.values(AUDIT_EXPORT_STAGE)
const OVERRIDE_LEVELS = [LOGIN_METHOD_SOURCE.GROUP, LOGIN_METHOD_SOURCE.DEVICE]
const SEARCH_METHODS = Object.values(AUDIT_SEARCH_METHOD)
const RELEASE_KINDS = Object.values(RELEASE_KIND)
const ENCOUNTER_ACTIONS = Object.values(ENCOUNTER_ACTION)
const SYNC_OUTCOMES = Object.values(REGISTRY_SYNC_OUTCOME)
const EMPTIED_BY_VALUES = Object.values(EMPTIED_BY)
const DISCARD_SITUATIONS = Object.values(AUDIT_DISCARD_SITUATION)
const EMPTIED_STATUSES = [ENCOUNTER_STATUS.PLANNED, ENCOUNTER_STATUS.CANCELLED]

function isObject(value: JsonValue | undefined): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: JsonValue | undefined): string | null {
	return typeof value === "string" ? value : null
}

function integer(value: JsonValue | undefined): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null
}

function texts(value: JsonValue | undefined): string[] | null {
	if (!Array.isArray(value)) {
		return null
	}
	return value.flatMap((item) => (typeof item === "string" ? [item] : []))
}

function oneOf<T extends string>(value: JsonValue | undefined, allowed: readonly T[]): T | null {
	return allowed.find((candidate) => candidate === value) ?? null
}

function listOf<T extends string>(value: JsonValue | undefined, allowed: readonly T[]): T[] {
	if (!Array.isArray(value)) {
		return []
	}
	return value.flatMap((item) => {
		const known = oneOf(item, allowed)
		return known === null ? [] : [known]
	})
}

function overridesOf(value: JsonValue | undefined): Overrides {
	if (!isObject(value)) {
		return {}
	}
	return Object.fromEntries(
		QUICK_LOGIN_METHODS.flatMap((method) => (typeof value[method] === "boolean" ? [[method, value[method]]] : [])),
	)
}

function codeReason(details: JsonObject): AuditRecordView["reason"] {
	const code = text(details.reason)
	return code === null ? null : { code, text: null }
}

function textReason(value: JsonValue | undefined): AuditRecordView["reason"] {
	const reason = text(value)
	return reason === null ? null : { code: null, text: reason }
}

// CAP-012-R32
function loginMethodsChange(row: AuditSearchRow): EventFields {
	const level = oneOf(row.details.level, OVERRIDE_LEVELS)
	if (level === null) {
		return {}
	}
	return {
		target_device_id: level === LOGIN_METHOD_SOURCE.DEVICE ? row.object_id : null,
		login_methods_change: {
			level,
			group_code: text(row.details.group_code),
			previous: overridesOf(row.details.previous_login_methods),
			current: overridesOf(row.details.login_methods),
		},
	}
}

// CAP-006-R18
function deviceGroupChange(details: JsonObject): AuditRecordView["device_group_change"] {
	const groupCode = text(details.group_code)
	return groupCode === null ? null : { previous_group_code: text(details.previous_group_code), group_code: groupCode }
}

// CAP-003-R11
function roleChange(details: JsonObject): AuditRecordView["role_change"] {
	const origin = oneOf(details.origin, ROLE_ORIGINS)
	return origin === null
		? null
		: { origin, previous_roles: listOf(details.previous_roles, ROLES), roles: listOf(details.roles, ROLES) }
}

// CAP-003-R07
function departmentChange(details: JsonObject): AuditRecordView["department_change"] {
	const origin = oneOf(details.origin, DEPARTMENT_ORIGINS)
	return origin === null
		? null
		: { origin, previous_department: text(details.previous_department), department: text(details.department) }
}

// NAB-442
function auditExport(row: AuditSearchRow): AuditRecordView["audit_export"] {
	const stage = oneOf(row.details.stage, EXPORT_STAGES)
	if (stage === null) {
		return null
	}
	return {
		export_id: row.object_id,
		stage,
		from: text(row.details.from),
		to: text(row.details.to),
		event_type: text(row.details.event_type),
		until_sequence: integer(row.details.until_sequence),
	}
}

// CAP-025-R21
function auditChainCheck(details: JsonObject): AuditRecordView["audit_chain_check"] {
	const firstBroken = text(details.first_broken_record_id)
	const checkedUntil = text(details.checked_until)
	return firstBroken === null || checkedUntil === null
		? null
		: { first_broken_record_id: firstBroken, checked_until: checkedUntil }
}

// CAP-025-R18
function patientSearch(details: JsonObject): EventFields {
	return {
		search_method: oneOf(details.search_method, SEARCH_METHODS),
		patient_identifier: text(details.patient_identifier),
		patient_identifiers: texts(details.patient_identifiers),
		released_item_count: integer(details.released_item_count),
	}
}

// CAP-025-R28
function patientRecordRelease(details: JsonObject): EventFields {
	return {
		patient_identifier: text(details.patient_identifier),
		release_kind: oneOf(details.release_kind, RELEASE_KINDS),
		encounter_id: text(details.encounter_id),
		acquisition_id: text(details.acquisition_id),
		released_item_count: integer(details.released_item_count),
	}
}

// CAP-025-R26, CAP-025-R17
function draftAcquisition(row: AuditSearchRow): EventFields {
	return {
		patient_identifier: text(row.details.patient_identifier),
		encounter_id: text(row.details.encounter_id),
		acquisition_id: row.object_id,
		operator_user_id: text(row.details.operator_user_id) ?? row.actor_user_id,
	}
}

// CAP-025-R20, CAP-015-R17, CAP-015-R19
function draftDiscard(row: AuditSearchRow): EventFields {
	return {
		...draftAcquisition(row),
		draft_discard_consent_id: text(row.details.draft_discard_consent_id),
		reason: codeReason(row.details),
		discard_situation: oneOf(row.details.situation, DISCARD_SITUATIONS),
		discarded_file_count: integer(row.details.discarded_file_count),
	}
}

// CAP-015-R19, CAP-015-R20
function draftDiscardConsent(details: JsonObject): EventFields {
	return {
		operator_user_id: text(details.operator_user_id),
		draft_discard_consent_id: text(details.draft_discard_consent_id),
		reason: codeReason(details),
	}
}

// CAP-023-R28, CAP-023-S24
function deliveryClosed(details: JsonObject): EventFields {
	const code = text(details.reason)
	return {
		acquisition_id: text(details.acquisition_id),
		delivery_id: text(details.delivery_id),
		delivery_instance_id: text(details.delivery_instance_id),
		reason: code === null ? null : { code, text: text(details.note) },
	}
}

// CAP-022-R15, CAP-022-S06
function textRecognitionRestarted(details: JsonObject): EventFields {
	const reason = text(details.reason)
	return {
		acquisition_id: text(details.acquisition_id),
		delivery_id: text(details.delivery_id),
		reason: reason === null ? null : { code: null, text: reason },
	}
}

// CAP-026-R14, CAP-026-S07, CAP-026-S08
function orphanedObject(details: JsonObject): EventFields {
	return { binary_object_id: text(details.binary_object_id), reason: textReason(details.reason) }
}

// CAP-004-R14
function draftsViewed(details: JsonObject): EventFields {
	return {
		operator_user_id: text(details.operator_user_id),
		released_item_count: integer(details.released_item_count),
		patient_identifiers: texts(details.patient_identifiers),
	}
}

// CAP-004-R10, CAP-025-R03
function acquisitionsViewed(details: JsonObject): EventFields {
	return {
		released_item_count: integer(details.released_item_count),
		patient_identifiers: texts(details.patient_identifiers),
	}
}

// CAP-014-R08
function assignmentChange(details: JsonObject): AuditRecordView["assignment_change"] {
	const change = details.assignment_change
	if (!isObject(change)) {
		return null
	}
	const previousPatient = text(change.previous_patient_identifier)
	const newPatient = text(change.new_patient_identifier)
	const previousEncounter = text(change.previous_encounter_id)
	const newEncounter = text(change.new_encounter_id)
	if (previousPatient === null || newPatient === null || previousEncounter === null || newEncounter === null) {
		return null
	}
	return {
		previous_patient_identifier: previousPatient,
		new_patient_identifier: newPatient,
		previous_encounter_id: previousEncounter,
		new_encounter_id: newEncounter,
	}
}

function draftAssignmentChanged(row: AuditSearchRow): EventFields {
	return { ...draftAcquisition(row), assignment_change: assignmentChange(row.details) }
}

// CAP-025-R29
function encounterEmptying(details: JsonObject): AuditRecordView["encounter_emptying"] {
	const emptying = details.encounter_emptying
	if (!isObject(emptying)) {
		return null
	}
	const previousStatus = oneOf(emptying.previous_status, [ENCOUNTER_STATUS.IN_PROGRESS])
	const newStatus = oneOf(emptying.new_status, EMPTIED_STATUSES)
	const emptiedBy = oneOf(emptying.emptied_by, EMPTIED_BY_VALUES)
	return previousStatus === null || newStatus === null || emptiedBy === null
		? null
		: { previous_status: previousStatus, new_status: newStatus, emptied_by: emptiedBy }
}

// CAP-025-R04
function encounterSubject(row: AuditSearchRow): EventFields {
	return { patient_identifier: text(row.details.patient_identifier), encounter_id: row.object_id }
}

function encounterEmptied(row: AuditSearchRow): EventFields {
	return { ...encounterSubject(row), encounter_emptying: encounterEmptying(row.details) }
}

// CAP-025-R27
function encounterCompletion(details: JsonObject): AuditRecordView["encounter_completion"] {
	const completion = details.encounter_completion
	if (!isObject(completion)) {
		return null
	}
	const previousStatus = oneOf(completion.previous_status, [ENCOUNTER_STATUS.IN_PROGRESS])
	const closedRecordCount = integer(completion.closed_record_count)
	return previousStatus === null || closedRecordCount === null
		? null
		: { previous_status: previousStatus, closed_record_count: closedRecordCount }
}

function encounterCompleted(row: AuditSearchRow): EventFields {
	return { ...encounterSubject(row), encounter_completion: encounterCompletion(row.details) }
}

function encounterActionRejected(row: AuditSearchRow): EventFields {
	return {
		...encounterSubject(row),
		encounter_action: oneOf(row.details.encounter_action, ENCOUNTER_ACTIONS),
		reason: codeReason(row.details),
	}
}

// CAP-025-R14, CAP-024-R12
function registrySyncRun(details: JsonObject): AuditRecordView["registry_sync_run"] {
	const startedAt = text(details.started_at)
	const finishedAt = text(details.finished_at)
	const outcome = oneOf(details.outcome, SYNC_OUTCOMES)
	const patientsAdded = integer(details.patients_added)
	const patientsChanged = integer(details.patients_changed)
	const encountersAdded = integer(details.encounters_added)
	const encountersChanged = integer(details.encounters_changed)
	if (
		startedAt === null ||
		finishedAt === null ||
		outcome === null ||
		patientsAdded === null ||
		patientsChanged === null ||
		encountersAdded === null ||
		encountersChanged === null
	) {
		return null
	}
	return {
		started_at: startedAt,
		finished_at: finishedAt,
		outcome,
		patients_added: patientsAdded,
		patients_changed: patientsChanged,
		encounters_added: encountersAdded,
		encounters_changed: encountersChanged,
	}
}

// CAP-025-R30, CAP-017-R02
function woundTypeChange(details: JsonObject): AuditRecordView["wound_type_change"] {
	const change = details.wound_type_change
	if (!isObject(change)) {
		return null
	}
	const findingId = text(change.finding_id)
	const code = text(change.wound_type_code)
	const version = text(change.code_list_version)
	if (findingId === null || code === null || version === null) {
		return null
	}
	return {
		finding_id: findingId,
		previous_wound_type_code: text(change.previous_wound_type_code),
		wound_type_code: code,
		code_list_version: version,
	}
}

// CAP-025-R22, datovy-model.md 8
function deviceEvent(details: JsonObject): EventFields {
	return {
		originated_on_device_at: text(details.originated_at),
		details: isObject(details.event_details) ? details.event_details : null,
	}
}

// CAP-025-R16, CAP-008-R11, administration.yaml AuditRecord lost_items
function lostItemsOf(value: JsonValue | undefined): AuditRecordView["lost_items"] {
	if (!isObject(value)) {
		return null
	}
	const count = integer(value.count)
	return count === null ? null : { count, oldest_acquired_at: text(value.oldest_acquired_at) }
}

// CAP-025-R22, CAP-008-S07, administration.yaml AuditRecord lost_items
function localDataDeletion(details: JsonObject): EventFields {
	const reported = isObject(details.event_details) ? details.event_details : null
	const isAfterModification = reported?.reason === LOCAL_DATA_DELETION_REASON.OS_MODIFICATION
	return { ...deviceEvent(details), lost_items: isAfterModification ? lostItemsOf(reported) : null }
}

// CAP-008-R09, CAP-025-R16, administration.yaml AuditRecord details, lost_items
function deviceBlocking(row: AuditSearchRow): EventFields {
	const { previous_state: previousState, unsent_items: unsentItems, ...reported } = row.details
	return {
		target_device_id: row.object_id,
		previous_device_state: oneOf(previousState, DEVICE_STATES),
		details: reported,
		lost_items: lostItemsOf(unsentItems),
	}
}

// CAP-021-R27, CAP-021-R38
function requeuedActorOf(details: JsonObject): string | null {
	return details.object_kind === CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR ? text(details.object_id) : null
}

// CAP-025-R03, CAP-025-R23, administration.yaml AuditRecord
export function eventFieldsOf(row: AuditSearchRow): EventFields {
	const details = row.details
	switch (row.event_type) {
		case AUDIT_EVENT_TYPE.LOGIN:
			return {
				scope: oneOf(details.scope, SCOPES),
				login_method: oneOf(details.method, LOGIN_METHODS),
				reason: codeReason(details),
			}
		case AUDIT_EVENT_TYPE.SESSION_REFRESH:
			return { scope: oneOf(details.scope, SCOPES) }
		case AUDIT_EVENT_TYPE.SESSION_TERMINATION:
			return { scope: oneOf(details.scope, SCOPES), reason: codeReason(details) }
		case AUDIT_EVENT_TYPE.DEVICE_REGISTRATION:
			return { reason: codeReason(details) }
		case AUDIT_EVENT_TYPE.CONFIGURATION_CHANGED:
			return { configuration_version: integer(details.version), reason: textReason(details.reason) }
		case AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED:
			return loginMethodsChange(row)
		case AUDIT_EVENT_TYPE.DEVICE_APPROVAL:
		case AUDIT_EVENT_TYPE.DEVICE_APPROVAL_REJECTED:
			return { target_device_id: row.object_id }
		case AUDIT_EVENT_TYPE.DEVICE_REVOCATION:
			return { target_device_id: row.object_id, previous_device_state: oneOf(details.previous_state, DEVICE_STATES) }
		case AUDIT_EVENT_TYPE.DEVICE_BLOCKING:
			return deviceBlocking(row)
		case AUDIT_EVENT_TYPE.DEVICE_UNBLOCKING:
			return {
				target_device_id: row.object_id,
				previous_device_state: oneOf(details.previous_state, DEVICE_STATES),
				reason: textReason(details.reason),
			}
		case AUDIT_EVENT_TYPE.DEVICE_ASSIGNED_TO_GROUP:
			return { target_device_id: row.object_id, device_group_change: deviceGroupChange(details) }
		case AUDIT_EVENT_TYPE.USER_ROLES_CHANGED:
			return { target_user_id: row.object_id, role_change: roleChange(details) }
		case AUDIT_EVENT_TYPE.USER_DEPARTMENT_CHANGED:
			return { target_user_id: row.object_id, department_change: departmentChange(details) }
		case AUDIT_EVENT_TYPE.CARD_BINDING_CODE_ISSUED:
			return {
				target_user_id: text(details.user_id),
				code_expires_at: text(details.expires_at),
				reason: textReason(details.note),
			}
		case AUDIT_EVENT_TYPE.CARD_BINDING_CREATED:
			return {
				target_user_id: text(details.user_id),
				card_id: row.outcome === AUDIT_OUTCOME.SUCCESS ? row.object_id : null,
				reason: codeReason(details),
			}
		case AUDIT_EVENT_TYPE.QR_CODE_ISSUED:
		case AUDIT_EVENT_TYPE.QR_CODE_REVOCATION:
			return { target_user_id: text(details.user_id), qr_code_id: row.object_id }
		case AUDIT_EVENT_TYPE.CARD_REVOCATION:
			return { target_user_id: text(details.user_id), card_id: row.object_id }
		case AUDIT_EVENT_TYPE.USER_REVOCATION:
			return { target_user_id: row.object_id }
		case AUDIT_EVENT_TYPE.LOCAL_DATA_DELETION:
			return localDataDeletion(details)
		case AUDIT_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH:
			return deviceEvent(details)
		case AUDIT_EVENT_TYPE.AUDIT_EXPORT:
			return { audit_export: auditExport(row), reason: codeReason(details) }
		case AUDIT_EVENT_TYPE.AUDIT_CHAIN_BROKEN:
			return { audit_chain_check: auditChainCheck(details) }
		case AUDIT_EVENT_TYPE.PATIENT_SEARCH:
			return patientSearch(details)
		case AUDIT_EVENT_TYPE.REGISTRY_SYNC_RUN:
			return { registry_sync_run: registrySyncRun(details) }
		case AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE:
			return patientRecordRelease(details)
		case AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CREATED:
		case AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED:
			return draftAcquisition(row)
		case AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD:
			return draftDiscard(row)
		case AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_ASSIGNMENT_CHANGED:
			return draftAssignmentChanged(row)
		case AUDIT_EVENT_TYPE.ENCOUNTER_EMPTIED:
			return encounterEmptied(row)
		case AUDIT_EVENT_TYPE.ENCOUNTER_COMPLETED:
			return encounterCompleted(row)
		case AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED:
			return encounterActionRejected(row)
		case AUDIT_EVENT_TYPE.FINDING_WOUND_TYPE_CHANGED:
			return {
				patient_identifier: text(details.patient_identifier),
				acquisition_id: text(details.acquisition_id),
				reason: codeReason(details),
				wound_type_change: woundTypeChange(details),
			}
		case AUDIT_EVENT_TYPE.CLINICAL_RECORD_WRITE_REQUEUED:
			return { target_user_id: requeuedActorOf(details) }
		case AUDIT_EVENT_TYPE.DRAFT_DISCARD_CONSENT_GRANTED:
			return draftDiscardConsent(details)
		case AUDIT_EVENT_TYPE.ACQUISITION_DRAFTS_VIEWED:
			return draftsViewed(details)
		case AUDIT_EVENT_TYPE.ACQUISITIONS_VIEWED:
			return acquisitionsViewed(details)
		case AUDIT_EVENT_TYPE.DELIVERY_CLOSED:
			return deliveryClosed(details)
		case AUDIT_EVENT_TYPE.TEXT_RECOGNITION_RESTARTED:
			return textRecognitionRestarted(details)
		case AUDIT_EVENT_TYPE.ORPHANED_OBJECT_SET_ASIDE:
		case AUDIT_EVENT_TYPE.ORPHANED_OBJECT_DELETION:
			return orphanedObject(details)
		default:
			return {}
	}
}
