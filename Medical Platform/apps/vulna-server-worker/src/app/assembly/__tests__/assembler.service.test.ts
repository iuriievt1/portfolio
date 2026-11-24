import { ACQUISITION_KIND, ADMINISTRATOR_ALERT_KIND, DELIVERY_STATE, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import {
	CLINICAL_RECORD_FAILURE,
	ClinicalRecordStoreError,
	ClosedRecordConflictError,
	dicomImageStreamOf,
	SOP_CLASS,
} from "@ansora/vulna-domain"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import { describe, expect, it } from "vitest"
import { exifSegment, withLeading } from "../../clinical-record-upload/__tests__/jpeg-fixtures"
import { TEXT_RECOGNITION_FAILURE } from "../../text-recognition/constants/text-recognition.constants"
import { TextRecognitionError } from "../../text-recognition/errors/text-recognition.error"
import { ASSEMBLY_FAILURE } from "../constants/assembly.constants"
import {
	ACQUISITION_ID,
	ALERT_ID,
	assemblyHarness,
	DELIVERY_ID,
	DESCRIPTION,
	DOCUMENT_ID,
	ENGLISH_ONLY_TITLE_CODE,
	HARDWARE_ID,
	IMPLEMENTATION_CLASS_UID,
	imageOf,
	jpeg,
	LANGUAGE,
	OPERATOR,
	objectIdOf,
	PATIENT_ID_VALUE,
	PDF_BYTES,
	RELEASE,
	recordOf,
	SERIES_INSTANCE_UID,
	STUDY_INSTANCE_UID,
	storedBytesOf,
	storedScanOf,
	storedWoundOf,
	TASK_ID,
	TITLE_TEXT,
} from "./assembly-fixtures"

const ROTATED = 6
// ITU-T T.81 B.1.1.3
const START_OF_SCAN = Buffer.from([0xff, 0xda])
const STATION_NAME_LENGTH = 16
// DICOM PS3.5 7.1.2, PS3.6 (0020,0013)
const INSTANCE_NUMBER_TAG = [0x20, 0x00, 0x13, 0x00]
const VALUE_LENGTH_BYTES = 2
// DICOM PS3.5 6.2
const PADDING = " "
const OTHER_ID = "f0000000-0000-4000-8000-000000000009"

function contains(bytes: Buffer, text: string): boolean {
	return bytes.includes(Buffer.from(text, "utf8"))
}

function instanceNumberElement(instanceNumber: number): Buffer {
	const digits = String(instanceNumber)
	const value = Buffer.from(digits.length % 2 === 0 ? digits : `${digits}${PADDING}`, "latin1")
	const length = Buffer.alloc(VALUE_LENGTH_BYTES)
	length.writeUInt16LE(value.length)
	return Buffer.concat([Buffer.from(INSTANCE_NUMBER_TAG), Buffer.from("IS", "latin1"), length, value])
}

function scanHarness(overrides: Parameters<typeof assemblyHarness>[0] = {}) {
	return assemblyHarness({ record: recordOf(ACQUISITION_KIND.SCAN), ...overrides })
}

describe("assembly of a closed record CAP-021-R04", () => {
	it("CAP-021-S02 CAP-021-S13 builds a VL Photographic object of every image and finishes the delivery in one step", async () => {
		const run = assemblyHarness()

		expect(await run.lane.runNext()).toBe(true)

		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `assembled ${DELIVERY_ID}`, `complete ${TASK_ID}`])
		expect(run.world.reservations).toEqual([
			[
				{ sourceKind: "image", sourceId: objectIdOf(1), sopClassUid: SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE },
				{ sourceKind: "image", sourceId: objectIdOf(2), sopClassUid: SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE },
			],
		])
		const [finished] = run.world.finished
		expect(finished?.deliveryId).toBe(DELIVERY_ID)
		expect(finished?.artifacts.map((artifact) => artifact.variants.map((variant) => variant.transferSyntax))).toEqual([
			[TRANSFER_SYNTAX.JPEG_BASELINE],
			[TRANSFER_SYNTAX.JPEG_BASELINE],
		])
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R07 CAP-021-S07 keeps the image stream of every snapshot byte for byte in the stored object", async () => {
		const run = assemblyHarness()

		await run.lane.runNext()

		const original = jpeg()
		const stream = Buffer.from(dicomImageStreamOf(original).bytes)
		const scan = original.subarray(original.indexOf(START_OF_SCAN))
		for (const bytes of storedBytesOf(run.world)) {
			expect(bytes.includes(stream)).toBe(true)
			expect(bytes.includes(scan)).toBe(true)
		}
	})

	it("ADR-054 bod 4 CAP-021-R11 CAP-021-R13 writes the study and series of the closed record, the operator and the station", async () => {
		const run = assemblyHarness()

		await run.lane.runNext()

		for (const bytes of storedBytesOf(run.world)) {
			expect(contains(bytes, "DICM")).toBe(true)
			expect(contains(bytes, STUDY_INSTANCE_UID)).toBe(true)
			expect(contains(bytes, SERIES_INSTANCE_UID)).toBe(true)
			expect(contains(bytes, `${OPERATOR.familyName}^${OPERATOR.givenName}`)).toBe(true)
			expect(contains(bytes, HARDWARE_ID.slice(0, STATION_NAME_LENGTH))).toBe(true)
			expect(contains(bytes, HARDWARE_ID)).toBe(false)
			expect(contains(bytes, IMPLEMENTATION_CLASS_UID)).toBe(true)
			expect(contains(bytes, RELEASE)).toBe(true)
			expect(contains(bytes, PATIENT_ID_VALUE)).toBe(true)
		}
	})

	it("CAP-021-R26 CAP-021-S15 writes the texts in the default language and keeps what it wrote", async () => {
		const run = assemblyHarness()

		await run.lane.runNext()

		const [artifact] = run.world.finished[0]?.artifacts ?? []
		expect(artifact?.texts).toEqual({
			language: LANGUAGE,
			seriesDescription: expect.any(String),
			instanceTitle: "ORIGINAL\\PRIMARY",
			instanceDescription: undefined,
		})
		const bytes = storedBytesOf(run.world)[0] ?? Buffer.alloc(0)
		expect(contains(bytes, "Dekubitus")).toBe(true)
		expect(contains(bytes, "Granulační")).toBe(true)
		expect(contains(bytes, DESCRIPTION)).toBe(true)
		expect(contains(bytes, "Pressure injury")).toBe(false)
	})

	it("CAP-021-S37 describes the series by the wound number and site only, without its type or phase", async () => {
		const run = assemblyHarness()

		await run.lane.runNext()

		const seriesDescription = run.world.finished[0]?.artifacts[0]?.texts.seriesDescription ?? ""
		expect(seriesDescription).toMatch(/^Rána 2 · /)
		expect(seriesDescription).not.toContain("Dekubitus")
		expect(seriesDescription).not.toContain("Granulační")
	})

	it("CAP-021-S26 marks an edited snapshot as derived and keeps the derivation it wrote", async () => {
		const run = assemblyHarness({
			images: [{ ...imageOf(1), editKind: "crop" }],
			record: recordOf(ACQUISITION_KIND.PHOTO, { fileCount: 1 }),
		})

		await run.lane.runNext()

		const [artifact] = run.world.finished[0]?.artifacts ?? []
		expect(artifact?.texts.instanceTitle).toBe("DERIVED\\PRIMARY")
		expect(artifact?.texts.instanceDescription).toEqual(expect.any(String))
	})

	it("CAP-021-S11 numbers the instances after the earlier records of the same series", async () => {
		const run = assemblyHarness({ record: recordOf(ACQUISITION_KIND.PHOTO, { firstInstanceNumber: 9 }) })

		await run.lane.runNext()

		const [first, second] = storedBytesOf(run.world)
		expect(first?.includes(instanceNumberElement(9))).toBe(true)
		expect(second?.includes(instanceNumberElement(10))).toBe(true)
	})

	it("CAP-022-S01 recognises the text, builds one Encapsulated PDF in both syntaxes and titles it in the default language", async () => {
		const run = scanHarness()

		await run.lane.runNext()

		expect(run.world.ocrTitles).toEqual([TITLE_TEXT])
		expect(run.world.reservations).toEqual([
			[{ sourceKind: "document", sourceId: DOCUMENT_ID, sopClassUid: SOP_CLASS.ENCAPSULATED_PDF }],
		])
		const [artifact] = run.world.finished[0]?.artifacts ?? []
		expect(artifact?.variants.map((variant) => variant.transferSyntax)).toEqual([
			TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN,
			TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN,
		])
		expect(artifact?.texts).toEqual({
			language: LANGUAGE,
			seriesDescription: undefined,
			instanceTitle: TITLE_TEXT,
			instanceDescription: undefined,
		})
		const [explicit] = storedBytesOf(run.world)
		expect(explicit?.includes(instanceNumberElement(1))).toBe(true)
		for (const bytes of storedBytesOf(run.world)) {
			expect(bytes.includes(PDF_BYTES)).toBe(true)
		}
	})

	it("CAP-018-R15 titles a document with its own text when it has no code", async () => {
		const run = scanHarness({ scan: storedScanOf({ title: { code: undefined, text: "Výsledek vyšetření" } }) })

		await run.lane.runNext()

		expect(run.world.ocrTitles).toEqual(["Výsledek vyšetření"])
		expect(run.world.finished[0]?.artifacts[0]?.texts.instanceTitle).toBe("Výsledek vyšetření")
	})

	it("CAP-022-R16 CAP-022-S08 fails a document whose title has no name in the default language before recognising text", async () => {
		const run = scanHarness({ scan: storedScanOf({ title: { code: ENGLISH_ONLY_TITLE_CODE, text: undefined } }) })

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.UNSUPPORTED_LANGUAGE])
		expect(run.world.ocrTitles).toEqual([])
	})
})

describe("assembly waits and fails CAP-022-R10 CAP-022-R11", () => {
	it("ADR-054 bod 4 waits and retries while the clinical record store does not answer, and fails nothing", async () => {
		const run = assemblyHarness()
		run.world.readError = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "store down")

		await run.lane.runNext()

		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
		expect(run.world.failed).toEqual([])
		expect(run.world.alerts).toEqual([])
	})

	it.each([
		["CAP-022-S03", TEXT_RECOGNITION_FAILURE.TIMED_OUT],
		["CAP-022-S06", TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED],
		["CAP-022-R10", TEXT_RECOGNITION_FAILURE.CRASHED],
		["CAP-022-R10", TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT],
	])("%s retries a recognition that %s and counts it", async (_, failure) => {
		const run = scanHarness()
		run.world.ocrError = new TextRecognitionError(failure, "the recognition failed")

		await run.lane.runNext()

		expect(run.world.textRecognitionFailures).toBe(1)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
		expect(run.world.failed).toEqual([])
		expect(run.world.reservations).toEqual([])
	})

	it("CAP-022-R10 still retries the second failed recognition", async () => {
		const run = scanHarness()
		run.world.ocrError = new TextRecognitionError(TEXT_RECOGNITION_FAILURE.TIMED_OUT, "too slow")
		run.world.textRecognitionFailures = 1

		await run.lane.runNext()

		expect(run.world.textRecognitionFailures).toBe(2)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
		expect(run.world.failed).toEqual([])
	})

	it("CAP-022-S03 CAP-022-R11 fails the delivery as ocr_failed on the third failed recognition and alerts the administrator", async () => {
		const run = scanHarness()
		run.world.ocrError = new TextRecognitionError(TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED, "too big")
		run.world.textRecognitionFailures = 2

		await run.lane.runNext()

		expect(run.world.failed).toEqual([
			{ acquisitionId: ACQUISITION_ID, deliveryId: DELIVERY_ID, reason: ASSEMBLY_FAILURE.OCR_FAILED },
		])
		expect(run.world.steps).toEqual([
			`assembling ${ACQUISITION_ID}`,
			`assembly failed ${ASSEMBLY_FAILURE.OCR_FAILED}`,
			`fail ${TASK_ID}`,
		])
		const [alert] = run.world.alerts
		expect(alert).toEqual({
			taskId: TASK_ID,
			deliveryId: DELIVERY_ID,
			message: expect.stringContaining(ACQUISITION_ID),
		})
		expect(run.world.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
				systemJob: SYSTEM_JOB.ASSEMBLY,
				objectId: ALERT_ID,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: {
					alert_id: ALERT_ID,
					alert_kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED,
					message: alert?.message,
					task_id: TASK_ID,
					delivery_id: DELIVERY_ID,
					acquisition_id: ACQUISITION_ID,
					reason: ASSEMBLY_FAILURE.OCR_FAILED,
				},
			},
		])
		expect(run.world.reservations).toEqual([])
		expect(run.world.finished).toEqual([])
	})

	it("CAP-022-R11 fails a document whose page is no whole JPEG at once, without retrying", async () => {
		const run = scanHarness()
		run.world.ocrError = new TextRecognitionError(TEXT_RECOGNITION_FAILURE.INVALID_PAGE, "not a JPEG")

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.OCR_FAILED])
		expect(run.world.textRecognitionFailures).toBe(0)
		expect(run.world.reservations).toEqual([])
	})

	it.each([
		TEXT_RECOGNITION_FAILURE.MODELS_MISSING,
		TEXT_RECOGNITION_FAILURE.START_FAILED,
		TEXT_RECOGNITION_FAILURE.ISOLATION_FAILED,
		TEXT_RECOGNITION_FAILURE.MEMORY_UNWATCHED,
	])("CAP-022-R02 waits without counting while text recognition itself cannot run (%s)", async (failure) => {
		const run = scanHarness()
		run.world.ocrError = new TextRecognitionError(failure, "the recognition cannot run")

		await run.lane.runNext()

		expect(run.world.textRecognitionFailures).toBe(0)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
	})

	it("ADR-054 bod 4 fails a photo record the clinical record store holds no closed record of", async () => {
		const run = assemblyHarness({ wound: undefined })

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.CLINICAL_RECORD_MISSING])
		expect(run.world.reservations).toEqual([])
	})

	it("ADR-054 bod 4 fails a scan the clinical record store holds no closed record of", async () => {
		const run = scanHarness({ scan: undefined })

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.CLINICAL_RECORD_MISSING])
		expect(run.world.ocrTitles).toEqual([])
	})

	it("ADR-054 bod 4 fails a record the clinical record store holds twice", async () => {
		const run = assemblyHarness()
		run.world.readError = new ClosedRecordConflictError("two closed records")

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH])
	})

	it.each([
		["the patient", { wound: storedWoundOf({ patientResourceId: "other-patient" }) }],
		[
			"the patient of the study",
			{ wound: storedWoundOf({ study: { ...storedWoundOf().study, patientResourceId: "other-patient" } }) },
		],
		["the study", { wound: storedWoundOf({ study: { ...storedWoundOf().study, studyInstanceUid: "2.25.9" } }) }],
		["the series", { wound: storedWoundOf({ study: { ...storedWoundOf().study, series: [] } }) }],
		["the finding", { wound: storedWoundOf({ findingId: OTHER_ID }) }],
		["the patient link", { record: recordOf(ACQUISITION_KIND.PHOTO, { patientResourceId: undefined }) }],
		["the document", { record: recordOf(ACQUISITION_KIND.SCAN), scan: storedScanOf({ documentId: OTHER_ID }) }],
	])("ADR-054 bod 4 refuses a closed record that differs from the server in %s (negative)", async (_, options) => {
		const run = assemblyHarness(options)

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH])
		expect(run.world.finished).toEqual([])
	})

	it.each([
		["no series", { record: recordOf(ACQUISITION_KIND.PHOTO, { series: undefined }) }],
		["no wound number", { record: recordOf(ACQUISITION_KIND.PHOTO, { woundNumber: undefined }) }],
		["fewer images than announced", { images: [imageOf(1)] }],
		["images not numbered from 1", { images: [imageOf(1), imageOf(3)] }],
		["pages not all received", { record: recordOf(ACQUISITION_KIND.SCAN), pageSequences: [1] }],
		["pages not numbered from 1", { record: recordOf(ACQUISITION_KIND.SCAN), pageSequences: [2, 3] }],
		["no device it was closed on", { record: recordOf(ACQUISITION_KIND.PHOTO, { closingHardwareId: undefined }) }],
		[
			"a document without a title",
			{
				record: recordOf(ACQUISITION_KIND.SCAN),
				scan: storedScanOf({ title: { code: undefined, text: undefined } }),
			},
		],
	])("CAP-021-R25 CAP-021-S09 fails a record with %s", async (_, options) => {
		const run = assemblyHarness(options)

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.INCOMPLETE_RECORD])
		expect(run.world.ocrTitles).toEqual([])
	})

	it("CAP-021-R07 refuses a turned snapshot and drops the bytes of the snapshot it already stored (negative)", async () => {
		const run = assemblyHarness()
		run.world.buffer.set(objectIdOf(12), withLeading(jpeg(), [exifSegment(ROTATED)]))
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.ROTATED_IMAGE])
		expect(new Set(run.world.buffer.keys())).toEqual(before)
	})

	it("CAP-021-R35 fails when the buffer holds no bytes of a snapshot", async () => {
		const run = assemblyHarness()
		run.world.buffer.delete(objectIdOf(11))

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.MISSING_BUFFER])
	})

	it.each([
		["healing phase", { wound: storedWoundOf({ healingPhaseCode: "unknown-phase" }) }],
		["wound type", { wound: storedWoundOf({ closedWoundTypeCode: "unknown-type" }) }],
		[
			"document title",
			{ record: recordOf(ACQUISITION_KIND.SCAN), scan: storedScanOf({ title: { code: "unknown-title", text: "x" } }) },
		],
	])("CAP-021-R26 fails a record whose %s code the code list does not know", async (_, options) => {
		const run = assemblyHarness(options)

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.UNKNOWN_CODE])
	})

	it("CAP-028-R15 records no audit event when the alert of the failed task is already raised", async () => {
		const run = assemblyHarness({ wound: undefined })
		run.world.isAlertRaised = false

		await run.lane.runNext()

		expect(run.world.failed.map((failure) => failure.reason)).toEqual([ASSEMBLY_FAILURE.CLINICAL_RECORD_MISSING])
		expect(run.world.audits).toEqual([])
	})
})

describe("assembly once CAP-021-R06", () => {
	it("CAP-022-R07 recognises and builds nothing again for a delivery that is already assembled", async () => {
		const run = scanHarness({
			record: recordOf(ACQUISITION_KIND.SCAN, { delivery: { id: DELIVERY_ID, state: DELIVERY_STATE.ASSEMBLED } }),
		})

		await run.lane.runNext()

		expect(run.world.steps).toEqual([`complete ${TASK_ID}`])
		expect(run.world.ocrTitles).toEqual([])
		expect(run.world.reservations).toEqual([])
	})

	it("keeps the task failed for a delivery whose assembly already failed", async () => {
		const run = assemblyHarness({
			record: recordOf(ACQUISITION_KIND.PHOTO, {
				delivery: { id: DELIVERY_ID, state: DELIVERY_STATE.ASSEMBLY_FAILED },
			}),
		})

		await run.lane.runNext()

		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
	})

	it("drops its own bytes and completes the task when another run assembled the delivery first", async () => {
		const run = assemblyHarness()
		run.world.lockedState = DELIVERY_STATE.ASSEMBLED
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(new Set(run.world.buffer.keys())).toEqual(before)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `complete ${TASK_ID}`])
	})

	it("drops its own bytes and keeps the task failed when another run failed the delivery first", async () => {
		const run = assemblyHarness()
		run.world.lockedState = DELIVERY_STATE.ASSEMBLY_FAILED
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(new Set(run.world.buffer.keys())).toEqual(before)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `fail ${TASK_ID}`])
	})

	it("keeps the task failed and the alert of another run when both runs failed the delivery", async () => {
		const run = assemblyHarness({ wound: undefined })
		run.world.lockedState = DELIVERY_STATE.ASSEMBLY_FAILED

		await run.lane.runNext()

		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `fail ${TASK_ID}`])
		expect(run.world.failed).toEqual([])
		expect(run.world.alerts).toEqual([])
		expect(run.world.audits).toEqual([])
	})

	it("drops the bytes the database did not record and retries when the final transaction fails", async () => {
		const run = assemblyHarness()
		run.world.finishError = new Error("connection lost")
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(new Set(run.world.buffer.keys())).toEqual(before)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
	})

	it("keeps the bytes and retries when it cannot learn whether the final transaction recorded them", async () => {
		const run = assemblyHarness()
		run.world.finishError = new Error("connection lost")
		run.world.recordedCheckError = new Error("database down")
		const before = run.world.buffer.size

		await run.lane.runNext()

		expect(run.world.buffer.size).toBe(before + 2)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
	})

	it("drops the bytes it stored and retries when the buffer fails half way through the snapshots", async () => {
		const run = assemblyHarness()
		run.world.putsBeforeFailure = 1
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(new Set(run.world.buffer.keys())).toEqual(before)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
	})

	it("drops the first variant of a document when the buffer fails on its second", async () => {
		const run = scanHarness()
		run.world.putsBeforeFailure = 1
		const before = new Set(run.world.buffer.keys())

		await run.lane.runNext()

		expect(new Set(run.world.buffer.keys())).toEqual(before)
		expect(run.world.steps).toEqual([`assembling ${ACQUISITION_ID}`, `retry ${TASK_ID}`])
	})

	it("CAP-021-R03 ADR-021 creates the delivery a record closed by an older release lacks and assembles it", async () => {
		const run = assemblyHarness({ record: recordOf(ACQUISITION_KIND.PHOTO, { delivery: undefined }) })

		await run.lane.runNext()

		expect(run.world.steps).toEqual([
			`delivery of ${ACQUISITION_ID}`,
			`assembling ${ACQUISITION_ID}`,
			`assembled ${DELIVERY_ID}`,
			`complete ${TASK_ID}`,
		])
	})

	it("completes a task whose record no longer exists", async () => {
		const run = assemblyHarness({ record: undefined })

		await run.lane.runNext()

		expect(run.world.steps).toEqual([`complete ${TASK_ID}`])
	})

	it("claims nothing while the settings are incomplete", async () => {
		const run = assemblyHarness({ hasSettings: false })

		expect(await run.lane.runNext()).toBe(false)
		expect(run.world.steps).toEqual([])
	})
})
