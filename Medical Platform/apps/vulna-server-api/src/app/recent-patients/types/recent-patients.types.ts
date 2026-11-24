import type { MobileContract } from "@ansora/contracts"
import type { FoundPatient } from "../../registry/types/registry.types"

type MobileSchemas = MobileContract.components["schemas"]

export type RecentPatientListView = MobileSchemas["RecentPatientList"]
export type RecentPatientItemView = MobileSchemas["RecentPatientItem"]

export interface LatestOwnRecordRow {
	acquisition_id: string
	patient_id: string
	encounter_id: string
	closed_at: Date
}

export interface RecentPatient {
	patient: FoundPatient
	lastDocumentedAt: Date
}
