import {
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	AUDIT_TEXT_FILTER_MAX_LENGTH,
	type AuditEventType,
	type AuditOutcome,
	SYSTEM_JOB,
	type SystemJob,
} from "@ansora/contracts"
import type { AuditExportRequest, AuditFilter } from "@/features/audit/types/audit.types"
import { endOfDay, isCalendarDate, startOfDay } from "@/lib/calendar-date"
import type { AuditExportValues, AuditFilterValues } from "./audit-filter.schema"

// DESIGN.md 9.1
const AUDIT_FILTER_PARAM = {
	FROM: "from",
	TO: "to",
	EVENT_TYPE: "event_type",
	OUTCOME: "outcome",
	USER: "user",
	DEVICE: "device",
	SYSTEM_JOB: "system_job",
} as const

export const EMPTY_AUDIT_FILTER: AuditFilter = {
	fromDate: undefined,
	toDate: undefined,
	eventType: undefined,
	outcome: undefined,
	user: undefined,
	device: undefined,
	systemJob: undefined,
	patientIdentifier: undefined,
}

export const ANY_VALUE = ""

export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = Object.values(AUDIT_EVENT_TYPE)
export const AUDIT_OUTCOMES: readonly AuditOutcome[] = Object.values(AUDIT_OUTCOME)
export const SYSTEM_JOBS: readonly SystemJob[] = Object.values(SYSTEM_JOB)

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
	return allowed.find((candidate) => candidate === value)
}

function textOf(value: string | null): string | undefined {
	const trimmed = value?.trim()
	return trimmed === undefined || trimmed === "" || trimmed.length > AUDIT_TEXT_FILTER_MAX_LENGTH ? undefined : trimmed
}

function dateOf(value: string | null): string | undefined {
	return value !== null && isCalendarDate(value) ? value : undefined
}

export function filterOfValues(values: AuditFilterValues): AuditFilter {
	return {
		fromDate: dateOf(values.fromDate),
		toDate: dateOf(values.toDate),
		eventType: oneOf(values.eventType, AUDIT_EVENT_TYPES),
		outcome: oneOf(values.outcome, AUDIT_OUTCOMES),
		user: textOf(values.user),
		device: textOf(values.device),
		systemJob: oneOf(values.systemJob, SYSTEM_JOBS),
		patientIdentifier: textOf(values.patientIdentifier),
	}
}

export function valuesOfFilter(filter: AuditFilter): AuditFilterValues {
	return {
		fromDate: filter.fromDate ?? "",
		toDate: filter.toDate ?? "",
		eventType: filter.eventType ?? "",
		outcome: filter.outcome ?? "",
		user: filter.user ?? "",
		device: filter.device ?? "",
		systemJob: filter.systemJob ?? "",
		patientIdentifier: filter.patientIdentifier ?? "",
	}
}

export function auditFilterOf(params: URLSearchParams, patientIdentifier: string | undefined): AuditFilter {
	return {
		fromDate: dateOf(params.get(AUDIT_FILTER_PARAM.FROM)),
		toDate: dateOf(params.get(AUDIT_FILTER_PARAM.TO)),
		eventType: oneOf(params.get(AUDIT_FILTER_PARAM.EVENT_TYPE), AUDIT_EVENT_TYPES),
		outcome: oneOf(params.get(AUDIT_FILTER_PARAM.OUTCOME), AUDIT_OUTCOMES),
		user: textOf(params.get(AUDIT_FILTER_PARAM.USER)),
		device: textOf(params.get(AUDIT_FILTER_PARAM.DEVICE)),
		systemJob: oneOf(params.get(AUDIT_FILTER_PARAM.SYSTEM_JOB), SYSTEM_JOBS),
		patientIdentifier,
	}
}

// DESIGN.md 9.1
export function searchParamsOf(filter: AuditFilter): Record<string, string> {
	const entries: [string, string | undefined][] = [
		[AUDIT_FILTER_PARAM.FROM, filter.fromDate],
		[AUDIT_FILTER_PARAM.TO, filter.toDate],
		[AUDIT_FILTER_PARAM.EVENT_TYPE, filter.eventType],
		[AUDIT_FILTER_PARAM.OUTCOME, filter.outcome],
		[AUDIT_FILTER_PARAM.USER, filter.user],
		[AUDIT_FILTER_PARAM.DEVICE, filter.device],
		[AUDIT_FILTER_PARAM.SYSTEM_JOB, filter.systemJob],
	]
	return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== undefined))
}

export function isFiltered(filter: AuditFilter): boolean {
	return Object.values(filter).some((value) => value !== undefined)
}

// administration.yaml searchAudit
export function auditQueryOf(filter: AuditFilter): Readonly<Record<string, string | undefined>> {
	return {
		from: startOfDay(filter.fromDate),
		to: endOfDay(filter.toDate),
		event_type: filter.eventType,
		outcome: filter.outcome,
		user: filter.user,
		device: filter.device,
		system_job: filter.systemJob,
		patient_identifier: filter.patientIdentifier,
	}
}

// administration.yaml exportAudit
export function exportRequestOf(values: AuditExportValues): AuditExportRequest {
	return {
		from: startOfDay(dateOf(values.fromDate)),
		to: endOfDay(dateOf(values.toDate)),
		event_type: oneOf(values.eventType, AUDIT_EVENT_TYPES),
	}
}
