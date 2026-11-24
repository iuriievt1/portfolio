import {
	AUDIT_EVENT_TYPE,
	type AuthorizationEndpointMismatchDetails,
	DEVICE_EVENT_TYPE,
	INTEGRITY_SIGNALS,
	type IntegrityReport,
	type IntegritySignal,
	LOCAL_DATA_DELETION_REASONS,
	type LocalDataDeletionDetails,
} from "@ansora/contracts"
import type { AuditRecord } from "@/features/audit/types/audit.types"

type ReportedEvent = Pick<AuditRecord, "event_type" | "details">

function textOf(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined
}

function optionalTextOf(value: unknown): string | null | undefined {
	return value === null ? null : textOf(value)
}

// CAP-025-R22, identity.yaml LocalDataDeletionDetails
export function localDataDeletionOf(record: ReportedEvent): LocalDataDeletionDetails | undefined {
	const details = record.details
	if (record.event_type !== DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION || details === null || details === undefined) {
		return undefined
	}
	const reason = LOCAL_DATA_DELETION_REASONS.find((known) => known === details.reason)
	const count = details.count
	const oldest = optionalTextOf(details.oldest_acquired_at)
	if (reason === undefined || typeof count !== "number" || !Number.isInteger(count) || oldest === undefined) {
		return undefined
	}
	return { reason, count, oldest_acquired_at: oldest }
}

// CAP-001-R32, identity.yaml AuthorizationEndpointMismatchDetails
export function authorizationEndpointMismatchOf(
	record: ReportedEvent,
): AuthorizationEndpointMismatchDetails | undefined {
	const details = record.details
	if (
		record.event_type !== DEVICE_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH ||
		details === null ||
		details === undefined
	) {
		return undefined
	}
	const server = textOf(details.server_authorization_endpoint)
	const provider = optionalTextOf(details.provider_authorization_endpoint)
	const discovery = textOf(details.discovery_url)
	if (server === undefined || provider === undefined || discovery === undefined) {
		return undefined
	}
	return { server_authorization_endpoint: server, provider_authorization_endpoint: provider, discovery_url: discovery }
}

type DeviceBlockingDetails = Pick<IntegrityReport, "signals" | "detected_at"> & { app_version: string }

function isIntegritySignal(value: unknown): value is IntegritySignal {
	return INTEGRITY_SIGNALS.some((signal) => signal === value)
}

function signalsOf(value: unknown): IntegritySignal[] | undefined {
	if (!Array.isArray(value) || value.length === 0 || !value.every(isIntegritySignal)) {
		return undefined
	}
	return value
}

// CAP-008-R09, CAP-025-R16, administration.yaml AuditRecord device-blocking
export function deviceBlockingOf(record: ReportedEvent): DeviceBlockingDetails | undefined {
	const details = record.details
	if (record.event_type !== AUDIT_EVENT_TYPE.DEVICE_BLOCKING || details === null || details === undefined) {
		return undefined
	}
	const signals = signalsOf(details.signals)
	const detectedAt = textOf(details.detected_at)
	const appVersion = textOf(details.app_version)
	if (signals === undefined || detectedAt === undefined || appVersion === undefined) {
		return undefined
	}
	return { signals, detected_at: detectedAt, app_version: appVersion }
}
