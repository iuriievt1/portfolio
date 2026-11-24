import type { LocalizedNames } from "@ansora/contracts"
import type {
	ClosedSeries,
	DicomCommonSource,
	DicomDocumentObject,
	DicomDocumentTitleSource,
	DicomImageObject,
	StoredRecord,
	StoredScanRecord,
	StoredWoundRecord,
} from "@ansora/vulna-domain"
import { ASSEMBLY_FAILURE, VALUE_SEPARATOR } from "../constants/assembly.constants"
import { AssemblyFailure } from "../errors/assembly-failure.error"
import type { AssemblyRecord, AssemblySettings, InstanceOfFile, WrittenTexts } from "../types/assembly.types"

function incomplete(record: AssemblyRecord, what: string): AssemblyFailure {
	return new AssemblyFailure(ASSEMBLY_FAILURE.INCOMPLETE_RECORD, `record ${record.acquisitionId} has ${what}`)
}

function mismatch(record: AssemblyRecord, what: string): AssemblyFailure {
	return new AssemblyFailure(
		ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH,
		`the clinical record of ${record.acquisitionId} differs from the server in ${what}`,
	)
}

// ADR-054 bod 4, CAP-021-R11, CAP-021-R12, CAP-014-R26
export function consistentSeriesOf(record: AssemblyRecord, stored: StoredRecord): ClosedSeries {
	const { series } = record
	if (series === undefined) {
		throw incomplete(record, "no series")
	}
	if (record.patientResourceId === undefined) {
		throw mismatch(record, "the patient it was never linked to")
	}
	if (
		stored.patientResourceId !== record.patientResourceId ||
		stored.study.patientResourceId !== record.patientResourceId
	) {
		throw mismatch(record, "the patient")
	}
	if (stored.study.studyInstanceUid !== record.encounter.studyInstanceUid) {
		throw mismatch(record, "the study")
	}
	const storedSeries = stored.study.series.find((candidate) => candidate.seriesInstanceUid === series.seriesInstanceUid)
	if (storedSeries === undefined || storedSeries.number !== series.number) {
		throw mismatch(record, "the series")
	}
	return storedSeries
}

// ADR-054 bod 4, CAP-021-R11
export function requireSameFinding(record: AssemblyRecord, stored: StoredWoundRecord): void {
	if (record.findingId === undefined || stored.findingId !== record.findingId) {
		throw mismatch(record, "the finding")
	}
}

// ADR-054 bod 4, CAP-021-R39
export function requireSameDocument(record: AssemblyRecord, stored: StoredScanRecord): string {
	if (record.documentId === undefined || stored.documentId !== record.documentId) {
		throw mismatch(record, "the document")
	}
	return record.documentId
}

// CAP-021-R25, CAP-015-R33, CAP-021-S09, backend.md 5
export function requireCompleteFiles(record: AssemblyRecord, sequences: readonly number[]): void {
	if (sequences.length === 0 || sequences.length !== record.fileCount) {
		throw incomplete(record, `${sequences.length} received files for ${record.fileCount ?? "no"} announced`)
	}
	if (sequences.some((sequence, index) => sequence !== index + 1)) {
		throw incomplete(record, "files not numbered from 1")
	}
}

// CAP-020-R23, integrace-dicom.md 5.3, 5.4
export function woundNumberOf(record: AssemblyRecord): number {
	if (record.woundNumber === undefined) {
		throw incomplete(record, "no wound number")
	}
	return record.woundNumber
}

// integrace-dicom.md 5.4, CAP-021-R11, CAP-021-R25
export function instanceNumberOf(record: AssemblyRecord, sequence: number): number {
	if (record.firstInstanceNumber === undefined) {
		throw incomplete(record, "no first instance number")
	}
	return record.firstInstanceNumber + sequence - 1
}

// integrace-dicom.md 5, CAP-021-R13, CAP-021-R26, ADR-054 bod 4
export function commonSourceOf(
	record: AssemblyRecord,
	series: ClosedSeries,
	instance: InstanceOfFile,
	settings: AssemblySettings,
	builtAt: Date,
): DicomCommonSource {
	if (record.closingHardwareId === undefined) {
		throw incomplete(record, "no device it was closed on")
	}
	return {
		assembly: {
			builtAt,
			language: settings.language,
			softwareVersion: settings.softwareVersion,
			patientIdSystem: settings.patientIdSystem,
		},
		patient: record.patient,
		encounter: record.encounter,
		series: { seriesInstanceUid: series.seriesInstanceUid, seriesNumber: series.number },
		operator: record.operator,
		station: { hardwareId: record.closingHardwareId },
		instance: {
			sopInstanceUid: instance.sopInstanceUid,
			instanceNumber: instanceNumberOf(record, instance.sequence),
			acquiredAt: record.startedAt,
		},
	}
}

// CAP-021-R26, CAP-017-R18
export function requiredNamesOf(
	names: LocalizedNames | undefined,
	code: string,
	record: AssemblyRecord,
): LocalizedNames {
	if (names === undefined) {
		throw new AssemblyFailure(
			ASSEMBLY_FAILURE.UNKNOWN_CODE,
			`record ${record.acquisitionId} carries unknown code ${code}`,
		)
	}
	return names
}

// integrace-dicom.md 5.6, CAP-018-R15, CAP-021-R26
export function titleSourceOf(
	names: LocalizedNames | undefined,
	text: string | undefined,
	record: AssemblyRecord,
): DicomDocumentTitleSource {
	if (names !== undefined) {
		return { names }
	}
	if (text === undefined) {
		throw incomplete(record, "a document without a title")
	}
	return { text }
}

// integrace-dicom.md 5.9, datovy-model.md 13.2
export function writtenTextsOfImage(object: DicomImageObject, language: string): WrittenTexts {
	return {
		language,
		seriesDescription: object.wound.seriesDescription,
		instanceTitle: object.wound.imageType.join(VALUE_SEPARATOR),
		instanceDescription: object.wound.derivationDescription,
	}
}

// integrace-dicom.md 5.9, datovy-model.md 13.2
export function writtenTextsOfDocument(object: DicomDocumentObject, language: string): WrittenTexts {
	return {
		language,
		seriesDescription: undefined,
		instanceTitle: object.document.documentTitle,
		instanceDescription: undefined,
	}
}
