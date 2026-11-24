import type {
	AdministrationContract,
	AdministratorAlertKind,
	BinaryRendition,
	ClinicalRecordWriteObjectKind,
	DependencyState,
} from "@ansora/contracts"
import type { JsonObject } from "@ansora/core-server"
import type { MomentPage } from "../../infra/utils/cursor-moment"

type AdministrationSchemas = AdministrationContract.components["schemas"]

export type AdministratorAlertView = AdministrationSchemas["AdministratorAlert"]
export type AdministratorAlertsPageView = AdministrationSchemas["AdministratorAlertsPage"]
export type OperationalMetricsView = AdministrationSchemas["OperationalMetrics"]

export interface AdministratorAlertRow {
	id: string
	kind: AdministratorAlertKind
	raised_at: Date
	resolved_at: Date | null
	message: string
	audit_id: string | null
	delivery_id: string | null
	delivery_instance_id: string | null
	target_code: string | null
	set_aside_object_count: number | null
	acknowledged_at: Date | null
	acknowledged_by_user_id: string | null
	cursor_moment: string
	task_id: string | null
	object_kind: ClinicalRecordWriteObjectKind | null
	object_id: string | null
	image_acquisition_id: string | null
	page_document_id: string | null
	pdf_document_id: string | null
	pending_rendition: BinaryRendition | null
}

export interface AdministratorAlertQuery {
	limit: number
	cursor: string | undefined
	kind: AdministratorAlertKind | undefined
	isActive: boolean | undefined
}

export type AdministratorAlertPage = MomentPage<AdministratorAlertRow>

export interface RaisedAlert {
	alertId: string
	kind: AdministratorAlertKind
	message: string
	subject: JsonObject
}

// administration.yaml acknowledgeAdministratorAlert
export interface LockedAlert {
	kind: AdministratorAlertKind
	resolved_at: Date | null
	delivery_id: string | null
	delivery_instance_id: string | null
}

export interface WriteTaskRow {
	id: string
	kind: string
	state: string
	object_kind: ClinicalRecordWriteObjectKind
	object_id: string
}

export interface ActiveAlertCountRow {
	kind: AdministratorAlertKind
	count: number
}

// CAP-028-R10
export interface SurveillanceSnapshot {
	operational: OperationalMetricsView | undefined
	dependencies: Readonly<Record<string, DependencyState>>
	activeAlerts: readonly ActiveAlertCountRow[] | undefined
	rejectedRequestTotal: number
	outageSeconds: number | undefined
}

export interface OperationalMetricsRow {
	write_waiting: number
	write_failed: number
	upload_waiting: number
	upload_failed: number
	oldest_open_upload_at: Date | null
	buffer_bytes: string
	buffer_files_waiting_for_deletion: number
	delivery_waiting: number
	delivery_permanently_failed: number
	delivery_held_for_review: number
	delivery_assembly_failed: number
	devices_pending_approval: number
	devices_revoked: number
}
