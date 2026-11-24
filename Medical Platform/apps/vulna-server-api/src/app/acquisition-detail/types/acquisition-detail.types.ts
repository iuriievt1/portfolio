import type { AcquisitionKind, MobileContract } from "@ansora/contracts"
import type { DocumentTitleFields } from "../../acquisition/types/acquisition-file.types"
import type { EncounterView } from "../../encounter/types/encounter.types"
import type { ClosedWoundTypeFields, RecordContentFields } from "../../finding/types/finding-history.types"
import type { RecordFileRow, RecordScope } from "../../image/types/image.types"
import type { PatientView } from "../../registry/types/registry.types"

type Schemas = MobileContract.components["schemas"]

export type AcquisitionDetailView = Schemas["AcquisitionDetail"]
export type AcquisitionDetailFileView = Schemas["AcquisitionDetailFile"]

// CAP-020-R17, datovy-model.md 2
export interface DetailRecordRow extends RecordScope, DocumentTitleFields, RecordContentFields, ClosedWoundTypeFields {
	id: string
	kind: AcquisitionKind
	patient_id: string
	encounter_id: string
	finding_id: string | null
	closed_at: Date | null
}

// CAP-020-R17
export interface ClosedDetailRecord extends DetailRecordRow {
	closed_at: Date
}

// clinical-workflow.yaml AcquisitionDetail
export interface DetailParts {
	patient: PatientView
	encounter: EncounterView
	files: readonly RecordFileRow[]
}
