import {
	AUDIT_EVENT_TYPE,
	AUDIT_SEARCH_METHOD,
	type AuditDiscardSituation,
	type AuditEventType,
	type AuditExportFailure,
	type AuditOutcome,
	type AuditSearchMethod,
	DELIVERY_CLOSURE_REASONS,
	DRAFT_DISCARD_REASONS,
	type DraftDiscardReason,
	type SystemJob,
} from "@ansora/contracts"
import type { AuditRecord } from "@/features/audit/types/audit.types"
import { closureReasonText } from "@/features/deliveries/lib/delivery-text"
import cs from "@/i18n/cs.json"
import { ADMINISTRATION_LOCALE, fillText, formatCount } from "@/lib/format"
import { AUDIT_EVENT_TYPES } from "./audit-filter"

const texts = cs.audit

const EVENT_TYPE_LABEL: Readonly<Record<AuditEventType, string>> = texts.eventType
const OUTCOME_LABEL: Readonly<Record<AuditOutcome, string>> = texts.outcome
const PATIENT_SEARCH_LABEL: Readonly<Record<AuditSearchMethod, string>> = texts.patientSearchEvent
const SYSTEM_JOB_LABEL: Readonly<Record<SystemJob, string>> = texts.systemJob
const EXPORT_FAILURE_LABEL: Readonly<Record<AuditExportFailure, string>> = texts.exportFailure
const DISCARD_SITUATION_LABEL: Readonly<Record<AuditDiscardSituation, string>> = texts.record.discardSituationValue
const DRAFT_DISCARD_REASON_LABEL: Readonly<Record<DraftDiscardReason, string>> = cs.drafts.consent.reasonValue

// CAP-025-R18, administration.yaml AuditRecord search_method
const PATIENT_LIST_RELEASES: ReadonlySet<AuditSearchMethod> = new Set([
	AUDIT_SEARCH_METHOD.SCHEDULED_LIST,
	AUDIT_SEARCH_METHOD.PATIENT_ENCOUNTERS,
	AUDIT_SEARCH_METHOD.RECENT_PATIENTS,
	AUDIT_SEARCH_METHOD.UNFINISHED_ENCOUNTERS,
])

const DRAFT_DISCARD_EVENTS: ReadonlySet<string> = new Set([
	AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD,
	AUDIT_EVENT_TYPE.DRAFT_DISCARD_CONSENT_GRANTED,
])

// CAP-025-R23
function labelOf(labels: Readonly<Record<string, string>>, code: string): string {
	return labels[code] ?? code
}

export function eventTypeText(code: string): string {
	return labelOf(EVENT_TYPE_LABEL, code)
}

type OutcomeRecord = Pick<AuditRecord, "event_type" | "search_method" | "outcome" | "released_item_count">

function patientSearchMethodOf(record: Pick<AuditRecord, "event_type" | "search_method">): AuditSearchMethod | null {
	if (record.event_type !== AUDIT_EVENT_TYPE.PATIENT_SEARCH) {
		return null
	}
	return record.search_method ?? null
}

// CAP-025-R07, CAP-025-R18
export function eventText(record: Pick<AuditRecord, "event_type" | "search_method">): string {
	const method = patientSearchMethodOf(record)
	return method === null ? eventTypeText(record.event_type) : labelOf(PATIENT_SEARCH_LABEL, method)
}

export function outcomeText(code: string): string {
	return labelOf(OUTCOME_LABEL, code)
}

// CAP-025-R07, CAP-025-R18
export function recordOutcomeText(record: OutcomeRecord): string {
	const method = patientSearchMethodOf(record)
	const count = record.released_item_count ?? null
	if (method === null || !PATIENT_LIST_RELEASES.has(method) || count === null) {
		return outcomeText(record.outcome)
	}
	return fillText(texts.listReleaseOutcome, { count: formatCount(count) })
}

export function systemJobText(job: SystemJob): string {
	return SYSTEM_JOB_LABEL[job]
}

export function exportFailureText(failure: AuditExportFailure): string {
	return EXPORT_FAILURE_LABEL[failure]
}

// CAP-025-R20
export function discardSituationText(situation: AuditDiscardSituation): string {
	return DISCARD_SITUATION_LABEL[situation]
}

function isDraftDiscardReason(code: string): code is DraftDiscardReason {
	return (DRAFT_DISCARD_REASONS as readonly string[]).includes(code)
}

// CAP-025-R20, CAP-015-R17, CAP-015-R19
export function draftDiscardReasonText(
	record: Pick<AuditRecord, "event_type" | "reason" | "draft_discard_consent_id">,
): string | undefined {
	if (!DRAFT_DISCARD_EVENTS.has(record.event_type)) {
		return undefined
	}
	const code = record.reason?.code ?? null
	if (code !== null && isDraftDiscardReason(code)) {
		return DRAFT_DISCARD_REASON_LABEL[code]
	}
	const isByOperator =
		record.event_type === AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD &&
		(record.draft_discard_consent_id ?? null) === null
	return isByOperator ? texts.record.discardedByOperator : undefined
}

// CAP-023-R28
export function deliveryClosureReasonText(code: string): string | undefined {
	const reason = DELIVERY_CLOSURE_REASONS.find((known) => known === code)
	return reason === undefined ? undefined : closureReasonText(reason)
}

// CAP-007-S07
export function reasonTermOf(eventType: string): string {
	return eventType === AUDIT_EVENT_TYPE.DEVICE_UNBLOCKING ? texts.record.reviewResult : texts.record.reason
}

// CAP-007-R08, CAP-008-R09, CAP-007-S07
export function previousStateTermOf(eventType: string): string {
	if (eventType === AUDIT_EVENT_TYPE.DEVICE_BLOCKING) {
		return texts.record.stateBeforeBlocking
	}
	if (eventType === AUDIT_EVENT_TYPE.DEVICE_UNBLOCKING) {
		return texts.record.stateAtUnblocking
	}
	return texts.record.previousState
}

export const EVENT_TYPE_OPTIONS: readonly { code: AuditEventType; label: string }[] = AUDIT_EVENT_TYPES.map((code) => ({
	code,
	label: EVENT_TYPE_LABEL[code],
})).sort((first, second) => first.label.localeCompare(second.label, ADMINISTRATION_LOCALE))

// CAP-025-R14
export function actorText(record: AuditRecord): string {
	if (record.user !== null && record.user !== undefined) {
		return record.user
	}
	if (record.system_job !== null && record.system_job !== undefined) {
		return systemJobText(record.system_job)
	}
	return record.device === undefined ? cs.common.notStated : texts.actor.device
}
