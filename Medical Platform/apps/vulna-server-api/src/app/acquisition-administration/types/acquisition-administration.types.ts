import type { AcquisitionKind, AdministeredAcquisitionState, AdministrationContract } from "@ansora/contracts"
import type { AcquisitionState } from "@ansora/vulna-domain"
import type { MomentPage } from "../../infra/utils/cursor-moment"
import type { FoundPatient } from "../../registry/types/registry.types"

type AdministrationSchemas = AdministrationContract.components["schemas"]

export type AdministeredAcquisitionView = AdministrationSchemas["AcquisitionDetail"]
export type AdministeredAcquisitionsPageView = AdministrationSchemas["AcquisitionsPage"]
export type AcquisitionInstanceView = NonNullable<AdministeredAcquisitionView["instance"]>[number]

export interface AdministeredAcquisitionRow {
	id: string
	kind: AcquisitionKind
	state: AcquisitionState
	file_count: number | null
	operator_user_id: string
	closing_device_id: string | null
	patient_id: string
	encounter_id: string
	started_at: Date
	closed_at: Date | null
	configuration_version: number
	configuration_created_at: Date
	configuration_author_user_id: string | null
	configuration_reason: string
	study_instance_uid: string
	series_instance_uid: string | null
	started_at_moment: string
}

export interface AcquisitionInstanceRow {
	sop_instance_uid: string
	sop_class_uid: string
	delivery_state: string
}

export interface AdministeredAcquisitionQuery {
	limit: number
	cursor: string | undefined
	state: AdministeredAcquisitionState | undefined
	patientIdentifier: string | undefined
	from: string | undefined
	to: string | undefined
}

export type AdministeredAcquisitionPage = MomentPage<AdministeredAcquisitionRow>

export interface AdministeredAcquisitionContext {
	patient: FoundPatient
	fileCount: number
	instances: readonly AcquisitionInstanceRow[] | undefined
}

export interface ReleasedAcquisition {
	row: AdministeredAcquisitionRow
	patient: FoundPatient
}
