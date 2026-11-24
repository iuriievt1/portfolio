import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, JOB_KIND, JOB_OBJECT_KIND } from "@ansora/core-server"
import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { BinaryUploadService } from "../services/binary-upload.service"
import {
	ALERT_ID,
	FILE_ID,
	fileOf,
	OWNER_REFERENCE,
	RECORD_ID,
	renditionOf,
	TASK_ID,
	taskOf,
	type UploadHarnessOptions,
	UploadWorld,
} from "./upload-fixtures"

const JPEG = "image/jpeg"
const KEPT_BINARY = "binary-kept"
const UNKNOWN_OUTCOMES_BEFORE_FAILURE = 10

function harness(options: UploadHarnessOptions = {}) {
	const world = new UploadWorld(options)
	const service = new BinaryUploadService(
		world.asDatabase(),
		world.asTasks(),
		world.asAlerts(),
		world.asAudit(),
		world.asFiles(),
		world.asStores(),
		world.asBinaryStore(),
	)
	return { world, service }
}

describe("upload of the bytes of a closed record CAP-021-R36", () => {
	it("CAP-021-S30 uploads the original, thumbnail and viewing copy, confirms each by its digest and queues the image resource", async () => {
		const run = harness()

		expect(await run.service.runNext()).toBe(true)

		expect(run.world.uploads.map((upload) => upload.placement)).toEqual([
			{ contentType: JPEG, ownerReference: OWNER_REFERENCE },
			{ contentType: JPEG, ownerReference: OWNER_REFERENCE },
			{ contentType: JPEG, ownerReference: OWNER_REFERENCE },
		])
		expect(run.world.steps).toEqual([
			"remember original as binary-1",
			"confirm original",
			"remember thumbnail as binary-2",
			"confirm thumbnail",
			"remember viewing-copy as binary-3",
			"confirm viewing-copy",
			`queue ${JOB_KIND.CLINICAL_RECORD_WRITE} of ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID}`,
			`complete ${TASK_ID}`,
		])
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R36 resolves the alert of the task in the transaction that completes it", async () => {
		const run = harness()

		await run.service.runNext()

		expect(run.world.resolvedAlerts).toEqual([TASK_ID])
	})

	it("CAP-021-R19 uploads a photo without a thumbnail or a viewing copy", async () => {
		const run = harness({ file: fileOf({ thumbnail: undefined, viewingCopy: undefined }) })

		await run.service.runNext()

		expect(run.world.uploads).toHaveLength(1)
		expect(run.world.steps.at(-1)).toBe(`complete ${TASK_ID}`)
	})

	it("CAP-021-S29 reads back the Binary remembered before a crash and uploads no second one", async () => {
		const original = renditionOf("original", { clinicalRecordBinaryId: KEPT_BINARY })
		const run = harness({
			file: fileOf({ original, thumbnail: renditionOf("thumbnail", { isUploaded: true }), viewingCopy: undefined }),
			keptBinaries: new Map([[KEPT_BINARY, Buffer.from("bytes of original")]]),
		})

		await run.service.runNext()

		expect(run.world.uploads).toEqual([])
		expect(run.world.steps).toEqual([
			"confirm original",
			`queue ${JOB_KIND.CLINICAL_RECORD_WRITE} of ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID}`,
			`complete ${TASK_ID}`,
		])
	})

	it("CAP-021-S29 uploads again when the remembered Binary is not in the store", async () => {
		const original = renditionOf("original", { clinicalRecordBinaryId: KEPT_BINARY })
		const run = harness({ file: fileOf({ original, thumbnail: undefined, viewingCopy: undefined }) })

		await run.service.runNext()

		expect(run.world.steps.slice(0, 2)).toEqual(["remember original as binary-1", "confirm original"])
	})

	it("CAP-021-S29 uploads again when the remembered Binary holds other bytes and confirms the new one", async () => {
		const original = renditionOf("original", { clinicalRecordBinaryId: KEPT_BINARY })
		const run = harness({
			file: fileOf({ original, thumbnail: undefined, viewingCopy: undefined }),
			keptBinaries: new Map([[KEPT_BINARY, Buffer.from("other bytes")]]),
		})

		await run.service.runNext()

		expect(run.world.uploads).toHaveLength(1)
		expect(run.world.steps).toEqual([
			"remember original as binary-1",
			"confirm original",
			`queue ${JOB_KIND.CLINICAL_RECORD_WRITE} of ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID}`,
			`complete ${TASK_ID}`,
		])
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R36 fails for good and alerts the administrator when the read-back digest differs", async () => {
		const run = harness({ readsBack: () => Buffer.from("other bytes") })

		await run.service.runNext()

		expect(run.world.steps).toEqual(["remember original as binary-1", `fail ${TASK_ID}`])
		expect(run.world.alerts).toEqual([
			{
				kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED,
				taskId: TASK_ID,
				message: expect.stringContaining(`nepřijalo snímek ${FILE_ID} záznamu ${RECORD_ID}`),
			},
		])
	})

	it("CAP-021-R36 fails for good and alerts the administrator when the buffer holds no bytes of the file", async () => {
		const run = harness()
		run.world.buffer.delete("original")

		await run.service.runNext()

		expect(run.world.uploads).toEqual([])
		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toEqual([
			{
				kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED,
				taskId: TASK_ID,
				message: expect.stringContaining(`snímek ${FILE_ID} záznamu ${RECORD_ID}`),
			},
		])
	})

	it("CAP-021-S29 confirms the Binary remembered before a crash even when the buffer no longer holds the file", async () => {
		const original = renditionOf("original", { clinicalRecordBinaryId: KEPT_BINARY })
		const run = harness({
			file: fileOf({ original, thumbnail: undefined, viewingCopy: undefined }),
			keptBinaries: new Map([[KEPT_BINARY, Buffer.from("bytes of original")]]),
		})
		run.world.buffer.delete("original")

		await run.service.runNext()

		expect(run.world.steps[0]).toBe("confirm original")
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R36 waits and tries again without an alert while the buffer cannot read the file", async () => {
		const run = harness()
		run.world.unreadable.add("original")

		await run.service.runNext()

		expect(run.world.steps).toEqual([`retry ${TASK_ID}`])
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R36 fails for good when the store rejects the bytes as a data error", async () => {
		const run = harness({ uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid") })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toHaveLength(1)
	})

	it("CAP-028-R15 records the alert in the audit trail without clinical content", async () => {
		const run = harness({ uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid") })

		await run.service.runNext()

		expect(run.world.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
				systemJob: SYSTEM_JOB.CLINICAL_RECORD_WRITE,
				objectId: ALERT_ID,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: {
					alert_id: ALERT_ID,
					alert_kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED,
					message: run.world.alerts[0]?.message,
					task_id: TASK_ID,
					object_kind: JOB_OBJECT_KIND.IMAGE,
					object_id: FILE_ID,
				},
			},
		])
	})

	it("CAP-021-S27 waits and tries again while the store is unavailable, without an alert", async () => {
		const run = harness({ uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "down") })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`retry ${TASK_ID}`])
		expect(run.world.alerts).toEqual([])
	})

	it("CAP-021-R27 counts an unknown outcome and tries again", async () => {
		const run = harness({ uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "timeout") })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`retry unknown ${TASK_ID}`])
	})

	it("CAP-021-R27 fails for good after ten unknown outcomes in a row", async () => {
		const run = harness({
			task: taskOf({ unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE - 1 }),
			uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "timeout"),
		})

		await run.service.runNext()

		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toHaveLength(1)
	})

	it("CAP-021-S27 claims nothing while the worker has no credential for the store", async () => {
		const run = harness({ isStoreConfigured: false })

		expect(await run.service.runNext()).toBe(false)

		expect(run.world.claims).toBe(0)
	})

	it("fails with an alert when the encounter of the file is not in the clinical record", async () => {
		const run = harness({ file: fileOf({ ownerReference: undefined }) })

		await run.service.runNext()

		expect(run.world.uploads).toEqual([])
		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toHaveLength(1)
	})

	it("names a page of a scanned document in the alert", async () => {
		const run = harness({
			file: fileOf({ kind: JOB_OBJECT_KIND.DOCUMENT_PAGE }),
			uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid"),
		})

		await run.service.runNext()

		expect(run.world.alerts[0]?.message).toContain(`nepřijalo stránku ${FILE_ID}`)
	})

	it("CAP-021-R37 uploads a page of a scanned document as a JPEG and queues the page resource", async () => {
		const run = harness({
			task: taskOf({ objectKind: JOB_OBJECT_KIND.DOCUMENT_PAGE }),
			file: fileOf({ kind: JOB_OBJECT_KIND.DOCUMENT_PAGE, thumbnail: undefined, viewingCopy: undefined }),
		})

		expect(await run.service.runNext()).toBe(true)

		expect(run.world.uploads.map((upload) => upload.placement)).toEqual([
			{ contentType: "image/jpeg", ownerReference: OWNER_REFERENCE },
		])
		expect(run.world.steps.at(-2)).toBe(
			`queue ${JOB_KIND.CLINICAL_RECORD_WRITE} of ${JOB_OBJECT_KIND.DOCUMENT_PAGE} ${FILE_ID}`,
		)
	})

	it("CAP-021-R39 uploads the output PDF of a document as a PDF and queues the document resource", async () => {
		const run = harness({
			task: taskOf({ objectKind: JOB_OBJECT_KIND.DOCUMENT, objectId: RECORD_ID }),
			file: fileOf({ kind: JOB_OBJECT_KIND.DOCUMENT, fileId: RECORD_ID, thumbnail: undefined, viewingCopy: undefined }),
		})

		expect(await run.service.runNext()).toBe(true)

		expect(run.world.uploads.map((upload) => upload.placement)).toEqual([
			{ contentType: "application/pdf", ownerReference: OWNER_REFERENCE },
		])
		expect(run.world.steps).toEqual([
			"remember original as binary-1",
			"confirm original",
			`queue ${JOB_KIND.CLINICAL_RECORD_WRITE} of ${JOB_OBJECT_KIND.DOCUMENT} ${RECORD_ID}`,
			`complete ${TASK_ID}`,
		])
	})

	it("CAP-021-R36 names the PDF of a document in the alert, without clinical content", async () => {
		const run = harness({
			task: taskOf({ objectKind: JOB_OBJECT_KIND.DOCUMENT, objectId: RECORD_ID }),
			file: fileOf({ kind: JOB_OBJECT_KIND.DOCUMENT, fileId: RECORD_ID, thumbnail: undefined, viewingCopy: undefined }),
			uploadFailure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid"),
		})

		await run.service.runNext()

		expect(run.world.alerts[0]?.message).toBe(
			`Úložiště klinického záznamu nepřijalo PDF dokumentu ${RECORD_ID}. PDF zůstává na serveru; doručení do PACS ` +
				"se tím nezastavilo a ze serveru se nic nesmaže, dokud nahrání neproběhne. Po odstranění příčiny nahrání " +
				"zopakujte.",
		)
	})

	it("completes the task of a file that no longer exists", async () => {
		const run = harness({ file: undefined })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`complete ${TASK_ID}`])
	})
})
