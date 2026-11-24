import type { BodySite } from "../body-diagram"
import type { AcquisitionKind, ClinicalDocumentTitle } from "./clinical-record-store.port"

// ADR-053 bod 3, CAP-020-R16, datovy-model.md 13.2
export interface ClinicalReader {
	membershipResourceId: string
}

// CAP-014-R19, CAP-014-R22
export interface EncounterResources {
	encounterResourceId: string
	imagingStudyResourceId: string | undefined
}

// CAP-016-R17, CAP-020-R19
export interface HistoryFinding {
	findingId: string
	woundTypeCode: string | undefined
}

// CAP-020-R17, CAP-020-R20, ADR-050 bod 4
export interface HistoryWoundRecord {
	acquisitionId: string
	findingId: string | undefined
	site: BodySite | undefined
	healingPhaseCode: string | undefined
	description: string | undefined
	closedWoundTypeCode: string | undefined
}

// CAP-020-R18, CAP-021-R39
export interface HistoryScanRecord {
	acquisitionId: string
	documentId: string
	closedAt: string
	title: ClinicalDocumentTitle
	pageCount: number
}

// CAP-020-R17, CAP-020-R22
export interface AcquisitionOfRecord {
	acquisitionId: string
	kind: AcquisitionKind
}

// CAP-016-R17, CAP-020-R20
export interface HistoryWounds {
	findings: readonly HistoryFinding[]
	wounds: readonly HistoryWoundRecord[]
}

export interface HistoryRecords extends HistoryWounds {
	scans: readonly HistoryScanRecord[]
}

// ADR-003 ř. 22, ADR-054 bod 2, CAP-020-R03, CAP-020-R16
export interface ImageHistoryPort {
	// CAP-016-R17, CAP-020-R20
	closedWoundsOfPatient(reader: ClinicalReader, patientResourceId: string): Promise<HistoryWounds>
	// CAP-020-R18
	closedScansOfPatient(reader: ClinicalReader, patientResourceId: string): Promise<readonly HistoryScanRecord[]>
	// CAP-014-R19, CAP-014-R22, CAP-014-R27
	closedAcquisitionsOfEncounters(
		reader: ClinicalReader,
		encounters: readonly EncounterResources[],
	): Promise<readonly string[]>
	// CAP-020-R01, CAP-020-R20
	closedRecordsOfFinding(reader: ClinicalReader, conditionResourceId: string): Promise<HistoryRecords>
	// CAP-020-R17, CAP-020-R22
	closedRecord(reader: ClinicalReader, acquisition: AcquisitionOfRecord): Promise<HistoryRecords>
}
