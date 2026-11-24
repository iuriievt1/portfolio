import { ACQUISITION_KIND } from "@ansora/contracts"
import { ClosedRecordConflictError, DICOM_MAPPING_FAILURE, DicomMappingError } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { MissingBufferError } from "../../clinical-record-upload/errors/missing-buffer.error"
import { TEXT_RECOGNITION_FAILURE } from "../../text-recognition/constants/text-recognition.constants"
import { ASSEMBLY_FAILURE, TEXT_RECOGNITION_FAILURE_CLASS } from "../constants/assembly.constants"
import { AssemblyFailure } from "../errors/assembly-failure.error"
import type { AssemblyFailureReason, AssemblyRecord } from "../types/assembly.types"
import { assemblyFailureMessageOf } from "../utils/assembly-alert"
import { assemblyFailureOf, textRecognitionFailureClassOf } from "../utils/assembly-failure"
import {
	commonSourceOf,
	consistentSeriesOf,
	instanceNumberOf,
	requireCompleteFiles,
	requiredNamesOf,
	titleSourceOf,
} from "../utils/assembly-source"
import {
	ACQUISITION_ID,
	DELIVERY_ID,
	HARDWARE_ID,
	LANGUAGE,
	OPERATOR,
	PATIENT_ID_SYSTEM,
	RELEASE,
	recordOf,
	SERIES_INSTANCE_UID,
	settingsOf,
	storedWoundOf,
} from "./assembly-fixtures"

const BUILT_AT = new Date("2026-11-06T10:00:00Z")
const SOP_INSTANCE_UID = "2.25.77"
const OTHER_SERIES_NUMBER = 9
const NO_READER = { closedWoundRecord: async () => undefined, closedScanRecord: async () => undefined }
const NAMES = { cs: "Zpráva", en: "Report" }

function assemblyRecordOf(overrides: Parameters<typeof recordOf>[1] = {}): AssemblyRecord {
	const record = recordOf(ACQUISITION_KIND.PHOTO, overrides)
	if (record.delivery === undefined) {
		throw new Error("the fixture record has no delivery")
	}
	return { ...record, delivery: record.delivery }
}

function seriesOfRecord(record: AssemblyRecord) {
	if (record.series === undefined) {
		throw new Error("the fixture record has no series")
	}
	return record.series
}

describe("source of the DICOM objects integrace-dicom.md 5", () => {
	it("CAP-021-R13 takes the operator who founded the record, the device that closed it and the capture time", () => {
		const record = assemblyRecordOf()
		const series = seriesOfRecord(record)

		const source = commonSourceOf(
			record,
			series,
			{ sopInstanceUid: SOP_INSTANCE_UID, sequence: 2 },
			settingsOf(NO_READER),
			BUILT_AT,
		)

		expect(source).toEqual({
			assembly: { builtAt: BUILT_AT, language: LANGUAGE, softwareVersion: RELEASE, patientIdSystem: PATIENT_ID_SYSTEM },
			patient: record.patient,
			encounter: record.encounter,
			series: { seriesInstanceUid: SERIES_INSTANCE_UID, seriesNumber: series.number },
			operator: OPERATOR,
			station: { hardwareId: HARDWARE_ID },
			instance: { sopInstanceUid: SOP_INSTANCE_UID, instanceNumber: 2, acquiredAt: record.startedAt },
		})
	})

	it("CAP-021-S11 continues the instance numbers of the series after the earlier records", () => {
		const record = assemblyRecordOf({ firstInstanceNumber: 7 })

		expect([1, 2, 3].map((sequence) => instanceNumberOf(record, sequence))).toEqual([7, 8, 9])
	})

	it("refuses a record without a first instance number", () => {
		expect(() => instanceNumberOf(assemblyRecordOf({ firstInstanceNumber: undefined }), 1)).toThrow(
			expect.objectContaining({ reason: ASSEMBLY_FAILURE.INCOMPLETE_RECORD }),
		)
	})

	it("ADR-054 bod 4 takes the series of the closed record when it matches the server", () => {
		const record = assemblyRecordOf()

		expect(consistentSeriesOf(record, storedWoundOf())).toEqual(seriesOfRecord(record))
	})

	it("ADR-054 bod 4 refuses a series whose number differs from the server (negative)", () => {
		const wound = storedWoundOf({
			study: {
				...storedWoundOf().study,
				series: [{ seriesInstanceUid: SERIES_INSTANCE_UID, number: OTHER_SERIES_NUMBER }],
			},
		})

		expect(() => consistentSeriesOf(assemblyRecordOf(), wound)).toThrow(
			expect.objectContaining({ reason: ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH }),
		)
	})

	it("CAP-021-R25 accepts the announced files numbered from 1 only", () => {
		const record = assemblyRecordOf()

		expect(() => requireCompleteFiles(record, [1, 2])).not.toThrow()
		for (const sequences of [[], [1], [1, 3], [2, 1]]) {
			expect(() => requireCompleteFiles(record, sequences)).toThrow(
				expect.objectContaining({ reason: ASSEMBLY_FAILURE.INCOMPLETE_RECORD }),
			)
		}
	})

	it("CAP-021-R26 CAP-017-R18 takes the names of a known code and refuses an unknown one", () => {
		const record = assemblyRecordOf()

		expect(requiredNamesOf(NAMES, "known", record)).toBe(NAMES)
		expect(() => requiredNamesOf(undefined, "unknown", record)).toThrow(
			expect.objectContaining({ reason: ASSEMBLY_FAILURE.UNKNOWN_CODE }),
		)
	})

	it("CAP-018-R15 titles a document by the names of its code, else by its own text, else not at all", () => {
		const record = assemblyRecordOf()

		expect(titleSourceOf(NAMES, "Vlastní", record)).toEqual({ names: NAMES })
		expect(titleSourceOf(undefined, "Vlastní", record)).toEqual({ text: "Vlastní" })
		expect(() => titleSourceOf(undefined, undefined, record)).toThrow(
			expect.objectContaining({ reason: ASSEMBLY_FAILURE.INCOMPLETE_RECORD }),
		)
	})
})

describe("failures of the assembly CAP-022-R10 CAP-022-R11", () => {
	it("CAP-022-R10 CAP-022-R11 counts the recognitions the document made fail, fails a bad page at once and waits for the rest", () => {
		const classes = Object.values(TEXT_RECOGNITION_FAILURE).map((failure) => [
			failure,
			textRecognitionFailureClassOf(failure),
		])

		expect(Object.fromEntries(classes)).toEqual({
			[TEXT_RECOGNITION_FAILURE.TIMED_OUT]: TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT,
			[TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED]: TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT,
			[TEXT_RECOGNITION_FAILURE.CRASHED]: TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT,
			[TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT]: TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT,
			[TEXT_RECOGNITION_FAILURE.INVALID_PAGE]: TEXT_RECOGNITION_FAILURE_CLASS.PAGE,
			[TEXT_RECOGNITION_FAILURE.MODELS_MISSING]: TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT,
			[TEXT_RECOGNITION_FAILURE.START_FAILED]: TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT,
			[TEXT_RECOGNITION_FAILURE.ISOLATION_FAILED]: TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT,
			[TEXT_RECOGNITION_FAILURE.MEMORY_UNWATCHED]: TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT,
		})
	})

	it("integrace-dicom.md 5 ADR-054 bod 4 turns mapping, buffer and record conflicts into a failure for good, and nothing else", () => {
		expect(assemblyFailureOf(new DicomMappingError(DICOM_MAPPING_FAILURE.ROTATED_IMAGE, "turned"))?.reason).toBe(
			ASSEMBLY_FAILURE.ROTATED_IMAGE,
		)
		expect(assemblyFailureOf(new MissingBufferError("b1"))?.reason).toBe(ASSEMBLY_FAILURE.MISSING_BUFFER)
		expect(assemblyFailureOf(new ClosedRecordConflictError("twice"))?.reason).toBe(
			ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH,
		)
		const failure = new AssemblyFailure(ASSEMBLY_FAILURE.UNKNOWN_CODE, "code")
		expect(assemblyFailureOf(failure)).toBe(failure)
		expect(assemblyFailureOf(new Error("connection lost"))).toBeUndefined()
	})

	it("CAP-028-R15 names the record and the cause for every reason", () => {
		for (const reason of Object.values(ASSEMBLY_FAILURE) as AssemblyFailureReason[]) {
			const message = assemblyFailureMessageOf({ acquisitionId: ACQUISITION_ID, deliveryId: DELIVERY_ID, reason })

			expect(message).toContain(ACQUISITION_ID)
			expect(message).not.toContain("undefined")
		}
	})

	it("CAP-022-R15 offers to restart the text recognition only when the recognition failed", () => {
		const messageFor = (reason: AssemblyFailureReason) =>
			assemblyFailureMessageOf({ acquisitionId: ACQUISITION_ID, deliveryId: DELIVERY_ID, reason })

		expect(messageFor(ASSEMBLY_FAILURE.OCR_FAILED)).toContain("Rozpoznání textu můžete znovu spustit")
		expect(messageFor(ASSEMBLY_FAILURE.MISSING_BUFFER)).not.toContain("znovu spustit")
	})
})
