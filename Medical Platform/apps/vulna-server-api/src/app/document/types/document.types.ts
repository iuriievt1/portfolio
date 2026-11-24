import type { MobileContract } from "@ansora/contracts"
import type { DocumentTitleFields } from "../../acquisition/types/acquisition-file.types"

type Schemas = MobileContract.components["schemas"]

export type PatientDocumentItemView = Schemas["PatientDocumentItem"]
export type PatientDocumentsPageView = Schemas["PatientDocumentsPage"]

// CAP-020-R18, CAP-021-R25
export interface PatientDocumentRow extends DocumentTitleFields {
	id: string
	encounter_id: string
	closed_at: Date
	file_count: number
	cursor_moment: string
}

export interface PatientDocumentPage {
	rows: PatientDocumentRow[]
	nextCursor: string | null
}
