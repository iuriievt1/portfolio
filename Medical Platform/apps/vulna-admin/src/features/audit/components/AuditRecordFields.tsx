import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/contracts"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { StatusPill } from "@/components/custom/status-pill"
import { outcomeTone } from "@/features/audit/constants/audit-tones"
import {
	actorText,
	deliveryClosureReasonText,
	discardSituationText,
	draftDiscardReasonText,
	eventTypeText,
	previousStateTermOf,
	reasonTermOf,
	recordOutcomeText,
} from "@/features/audit/lib/audit-text"
import {
	authorizationEndpointMismatchOf,
	deviceBlockingOf,
	localDataDeletionOf,
} from "@/features/audit/lib/device-event-details"
import type { AuditRecord } from "@/features/audit/types/audit.types"
import { signalsText } from "@/features/devices/lib/integrity-signals"
import { QUICK_LOGIN_METHODS } from "@/features/login-methods/constants/login-methods"
import type { LoginMethodOverrides } from "@/features/login-methods/types/login-methods.types"
import { rolesText } from "@/features/users/lib/user-text"
import cs from "@/i18n/cs.json"
import { fillText, formatCount, formatDateTime, formatList, formatPreciseDateTime } from "@/lib/format"
import { acquisitionPagePath, deliveryPagePath, devicePagePath, userPagePath } from "@/lib/routes"

const texts = cs.audit.record
const fieldTexts = cs.audit.fields

export interface Field {
	term: string
	value: ReactNode
}

type Optional<T> = T | null | undefined

function present<T>(value: Optional<T>): value is T {
	return value !== null && value !== undefined
}

function identifier(value: string): ReactNode {
	return <span className="identifier break-all">{value}</span>
}

function pageLink(to: string, label: string): ReactNode {
	return (
		<Link to={to} className="font-medium hover:underline">
			{label}
		</Link>
	)
}

function field<T>(term: string, value: Optional<T>, render: (value: T) => ReactNode): Field | undefined {
	return present(value) ? { term, value: render(value) } : undefined
}

function fieldsOf(candidates: readonly (Field | undefined)[]): Field[] {
	return candidates.filter((candidate) => candidate !== undefined)
}

// CAP-012-R02
function overridesText(overrides: LoginMethodOverrides): string {
	const set = QUICK_LOGIN_METHODS.flatMap((method) => {
		const value = overrides[method]
		if (typeof value !== "boolean") {
			return []
		}
		return [fillText(value ? texts.methodOn : texts.methodOff, { method: cs.loginMethods.method[method] })]
	})
	return set.length === 0 ? texts.noOverride : formatList(set)
}

function reasonOf(reason: NonNullable<AuditRecord["reason"]>): ReactNode {
	return reason.text ?? (reason.code === null ? cs.common.notStated : identifier(reason.code))
}

// CAP-025-R20, CAP-015-R17, CAP-015-R19, CAP-007-S07, CAP-023-R28
function reasonFieldOf(record: AuditRecord): Field | undefined {
	const draftDiscardReason = draftDiscardReasonText(record)
	if (draftDiscardReason !== undefined) {
		return { term: texts.reason, value: draftDiscardReason }
	}
	if (record.event_type === AUDIT_EVENT_TYPE.DELIVERY_CLOSED) {
		return field(texts.reason, record.reason?.code, (code) => deliveryClosureReasonText(code) ?? identifier(code))
	}
	return field(reasonTermOf(record.event_type), record.reason, reasonOf)
}

// CAP-023-R28, administration.yaml DeliveryClosure.note
function closureNoteFieldOf(record: AuditRecord): Field | undefined {
	if (record.event_type !== AUDIT_EVENT_TYPE.DELIVERY_CLOSED) {
		return undefined
	}
	return field(texts.note, record.reason?.text, (note) => (
		<span className="whitespace-pre-line break-words">{note}</span>
	))
}

function oldestDeletedText(oldestAcquiredAt: string | null): string {
	return oldestAcquiredAt === null ? texts.noneDeleted : formatDateTime(oldestAcquiredAt)
}

// CAP-025-R04
export function summaryOf(record: AuditRecord): Field[] {
	return fieldsOf([
		{ term: fieldTexts.time, value: <span className="num">{formatPreciseDateTime(record.time)}</span> },
		{
			term: fieldTexts.outcome,
			value: <StatusPill tone={outcomeTone(record.outcome)}>{recordOutcomeText(record)}</StatusPill>,
		},
		{ term: fieldTexts.actor, value: actorText(record) },
		field(texts.device, record.device, (id) => pageLink(devicePagePath(id), texts.openDevice)),
		field(fieldTexts.address, record.source_address, identifier),
		field(texts.patient, record.patient_identifier, identifier),
		field(texts.patients, record.patient_identifiers, (values) => identifier(formatList(values))),
		field(texts.session, record.session_id, identifier),
	])
}

// CAP-025-R03, CAP-025-R20, administration.yaml AuditRecord
export function eventDetailsOf(record: AuditRecord): Field[] {
	const approval = record.device_approval
	const methods = record.login_methods_change
	const group = record.device_group_change
	const roles = record.role_change
	const department = record.department_change
	const auditExport = record.audit_export
	const chain = record.audit_chain_check
	const syncRun = record.registry_sync_run
	const completion = record.encounter_completion
	const emptying = record.encounter_emptying
	const assignment = record.assignment_change
	const woundType = record.wound_type_change
	const deletion = localDataDeletionOf(record)
	const mismatch = authorizationEndpointMismatchOf(record)
	const blocking = deviceBlockingOf(record)
	const lostItems = deletion ?? record.lost_items
	return fieldsOf([
		field(texts.originatedOnDevice, record.originated_on_device_at, formatPreciseDateTime),
		field(texts.deletionReason, deletion?.reason, (reason) => texts.deletionReasonValue[reason]),
		field(texts.blockingSignals, blocking?.signals, signalsText),
		field(texts.blockingDetectedAt, blocking?.detected_at, formatPreciseDateTime),
		field(texts.blockingAppVersion, blocking?.app_version, identifier),
		field(texts.deletedCount, lostItems?.count, formatCount),
		field(texts.oldestDeleted, lostItems, (items) => oldestDeletedText(items.oldest_acquired_at)),
		field(texts.serverAuthorizationEndpoint, mismatch?.server_authorization_endpoint, identifier),
		field(texts.providerAuthorizationEndpoint, mismatch, (reported) =>
			reported.provider_authorization_endpoint === null
				? texts.issuerMismatch
				: identifier(reported.provider_authorization_endpoint),
		),
		field(texts.discoveryUrl, mismatch?.discovery_url, identifier),
		field(texts.searchMethod, record.search_method, (method) => texts.searchMethodValue[method]),
		field(texts.syncStartedAt, syncRun?.started_at, formatPreciseDateTime),
		field(texts.syncFinishedAt, syncRun?.finished_at, formatPreciseDateTime),
		field(texts.syncOutcome, syncRun?.outcome, (outcome) => texts.syncOutcomeValue[outcome]),
		field(texts.patientsAdded, syncRun?.patients_added, formatCount),
		field(texts.patientsChanged, syncRun?.patients_changed, formatCount),
		field(texts.encountersAdded, syncRun?.encounters_added, formatCount),
		field(texts.encountersChanged, syncRun?.encounters_changed, formatCount),
		field(texts.releaseKind, record.release_kind, (kind) => texts.releaseKindValue[kind]),
		field(texts.encounter, record.encounter_id, identifier),
		field(texts.acquisition, record.acquisition_id, (id) => pageLink(acquisitionPagePath(id), texts.openAcquisition)),
		field(texts.delivery, record.delivery_id, (id) => pageLink(deliveryPagePath(id), texts.openDelivery)),
		field(texts.deliveryInstance, record.delivery_instance_id, identifier),
		field(texts.binaryObject, record.binary_object_id, identifier),
		field(texts.operator, record.operator_user_id, (id) => pageLink(userPagePath(id), texts.openUser)),
		field(texts.consent, record.draft_discard_consent_id, identifier),
		field(texts.discardSituation, record.discard_situation, discardSituationText),
		field(texts.discardedFileCount, record.discarded_file_count, formatCount),
		field(texts.previousPatient, assignment?.previous_patient_identifier, identifier),
		field(texts.newPatient, assignment?.new_patient_identifier, identifier),
		field(texts.previousEncounter, assignment?.previous_encounter_id, identifier),
		field(texts.newEncounter, assignment?.new_encounter_id, identifier),
		field(texts.finding, woundType?.finding_id, identifier),
		field(texts.woundTypeBefore, woundType, (change) =>
			change.previous_wound_type_code === null ? texts.noWoundType : identifier(change.previous_wound_type_code),
		),
		field(
			record.outcome === AUDIT_OUTCOME.REJECTED ? texts.woundTypeRequested : texts.woundTypeAfter,
			woundType?.wound_type_code,
			identifier,
		),
		field(texts.codeListVersion, woundType?.code_list_version, identifier),
		field(texts.releasedCount, record.released_item_count, formatCount),
		field(texts.encounterAction, record.encounter_action, (action) => texts.encounterActionValue[action]),
		field(texts.previousStatus, completion?.previous_status, (status) => texts.encounterStatusValue[status]),
		field(texts.closedRecordCount, completion?.closed_record_count, formatCount),
		field(texts.statusBefore, emptying?.previous_status, (status) => texts.encounterStatusValue[status]),
		field(texts.statusAfter, emptying?.new_status, (status) => texts.encounterStatusValue[status]),
		field(texts.emptiedBy, emptying?.emptied_by, (act) => texts.emptiedByValue[act]),
		field(texts.scope, record.scope, (scope) => texts.scopeValue[scope]),
		field(texts.loginMethod, record.login_method, (method) => cs.loginMethods.method[method]),
		field(texts.targetUser, record.target_user_id, (id) => pageLink(userPagePath(id), texts.openUser)),
		field(texts.targetDevice, record.target_device_id, (id) => pageLink(devicePagePath(id), texts.openDevice)),
		reasonFieldOf(record),
		closureNoteFieldOf(record),
		field(texts.configurationVersion, record.configuration_version, formatCount),
		field(texts.approvalCode, approval?.fingerprint, identifier),
		field(texts.approvalRequester, approval?.requester_user_id, (id) => pageLink(userPagePath(id), texts.openUser)),
		field(texts.approvalPredecessor, approval?.blocked_predecessor_hw_id, identifier),
		field(texts.level, methods?.level, (level) => texts.levelValue[level]),
		field(texts.groupCode, methods?.group_code, identifier),
		field(texts.methodsBefore, methods?.previous, overridesText),
		field(texts.methodsAfter, methods?.current, overridesText),
		field(texts.groupBefore, group, (change) =>
			change.previous_group_code === null ? texts.noGroup : identifier(change.previous_group_code),
		),
		field(texts.groupAfter, group?.group_code, identifier),
		field(previousStateTermOf(record.event_type), record.previous_device_state, (state) => cs.devices.state[state]),
		field(texts.origin, roles?.origin ?? department?.origin, (origin) => texts.originValue[origin]),
		field(texts.rolesBefore, roles?.previous_roles, rolesText),
		field(texts.rolesAfter, roles?.roles, rolesText),
		field(texts.departmentBefore, department, (change) => change.previous_department ?? texts.noDepartment),
		field(texts.departmentAfter, department, (change) => change.department ?? texts.noDepartment),
		field(texts.codeExpiresAt, record.code_expires_at, formatDateTime),
		field(texts.card, record.card_id, identifier),
		field(texts.qrCode, record.qr_code_id, identifier),
		field(texts.exportStage, auditExport?.stage, (stage) => texts.exportStageValue[stage]),
		field(texts.exportFrom, auditExport?.from, formatDateTime),
		field(texts.exportTo, auditExport?.to, formatDateTime),
		field(fieldTexts.event, auditExport?.event_type, eventTypeText),
		field(texts.untilSequence, auditExport?.until_sequence, formatCount),
		field(texts.firstBroken, chain?.first_broken_record_id, identifier),
		field(texts.checkedUntil, chain?.checked_until, formatPreciseDateTime),
	])
}

// CAP-025-R21
export function chainOf(record: AuditRecord): Field[] {
	return [
		{ term: texts.hash, value: identifier(record.hash) },
		{
			term: texts.previousHash,
			value: record.previous_hash === null ? texts.first : identifier(record.previous_hash),
		},
		{ term: texts.id, value: identifier(record.id) },
	]
}
