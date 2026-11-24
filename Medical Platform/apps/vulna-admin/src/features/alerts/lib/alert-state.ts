import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	type AdministratorAlertKind,
	type BinaryRendition,
	CLINICAL_RECORD_WRITE_OBJECT_KIND,
} from "@ansora/contracts"
import { errorCodeOf } from "@/api/client"
import type { AdministratorAlert } from "@/features/alerts/types/alert.types"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

const texts = cs.alerts

export const ALERT_STATE = {
	ACTIVE: "active",
	RESOLVED: "resolved",
	REQUEUED: "requeued",
	ACKNOWLEDGED: "acknowledged",
} as const

export type AlertState = (typeof ALERT_STATE)[keyof typeof ALERT_STATE]

// administration.yaml listAdministratorAlerts is_active
export const ALERT_VIEW = {
	ACTIVE: "active",
	ALL: "all",
} as const

export type AlertView = (typeof ALERT_VIEW)[keyof typeof ALERT_VIEW]

const KIND_TEXT: Readonly<Record<AdministratorAlertKind, string>> = texts.kind
const RENDITION_TEXT: Readonly<Record<BinaryRendition, string>> = texts.rendition.value

export function alertViewOf(value: string | null): AlertView {
	return value === ALERT_VIEW.ALL ? ALERT_VIEW.ALL : ALERT_VIEW.ACTIVE
}

export function alertKindText(kind: AdministratorAlertKind): string {
	return KIND_TEXT[kind]
}

export interface AlertActions {
	requeuedAlertIds: ReadonlySet<string>
	acknowledgedAlertIds: ReadonlySet<string>
}

// CAP-021-R27, CAP-023-R12
export function alertStateOf(alert: AdministratorAlert, actions: AlertActions): AlertState {
	if (actions.acknowledgedAlertIds.has(alert.id) || (alert.acknowledgement ?? null) !== null) {
		return ALERT_STATE.ACKNOWLEDGED
	}
	if (!alert.is_active) {
		return ALERT_STATE.RESOLVED
	}
	return actions.requeuedAlertIds.has(alert.id) ? ALERT_STATE.REQUEUED : ALERT_STATE.ACTIVE
}

// CAP-023-R12, CHG-189, administration.yaml acknowledgeAdministratorAlert
export function isAcknowledgeable(alert: AdministratorAlert): boolean {
	return alert.is_active && alert.kind === ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING
}

// CAP-021-R27, CAP-021-S25, CAP-021-R36, CAP-021-R40
export function requeueTaskOf(alert: AdministratorAlert): string | undefined {
	if (!alert.is_active) {
		return undefined
	}
	switch (alert.kind) {
		case ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED:
			return alert.clinical_record_write?.task_id
		case ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED:
			return alert.clinical_record_binary_upload?.task_id ?? undefined
		default:
			return undefined
	}
}

// CAP-021-R36, CAP-021-R39, CAP-021-R40, administration.yaml AdministratorAlert.clinical_record_binary_upload
export function renditionTextOf(alert: AdministratorAlert): string | undefined {
	const rendition = alert.clinical_record_binary_upload?.rendition
	if (rendition === undefined) {
		return undefined
	}
	return fillText(texts.rendition.label, { rendition: RENDITION_TEXT[rendition] })
}

// CAP-021-R38
export function writeActorOf(alert: AdministratorAlert): string | undefined {
	const write = alert.clinical_record_write
	return write?.object_kind === CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR ? write.object_id : undefined
}

// CAP-025-R21, stavy-a-mikrocopy.md E47
export function brokenAuditRecordOf(alert: AdministratorAlert): string | undefined {
	if (alert.kind !== ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN) {
		return undefined
	}
	return alert.audit_record_id ?? undefined
}

// CAP-026-R16, stavy-a-mikrocopy.md E97
export function isStaleDraftsAlert(alert: AdministratorAlert): boolean {
	return alert.is_active && alert.kind === ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS
}

// CAP-026-R14, stavy-a-mikrocopy.md E67
export function isOrphanedObjectsAlert(alert: AdministratorAlert): boolean {
	return alert.is_active && alert.kind === ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE
}

// administration.yaml requeueClinicalRecordWrite 409
export function isAlreadyRequeued(error: unknown): boolean {
	return errorCodeOf(error) === ADMINISTRATION_ERROR_CODE.CLINICAL_RECORD_WRITE_NOT_FAILED
}

// administration.yaml acknowledgeAdministratorAlert 409
export function isNoLongerAcknowledgeable(error: unknown): boolean {
	return errorCodeOf(error) === ADMINISTRATION_ERROR_CODE.ALERT_NOT_ACKNOWLEDGEABLE
}
