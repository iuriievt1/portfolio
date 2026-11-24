import { randomUUID } from "node:crypto"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE, NO_PREVIOUS_HASH, QueueTaskStore } from "@ansora/core-server"
import { afterAll, describe, expect, it } from "vitest"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { UPLOAD_ALERT_KIND, UPLOAD_JOB_KIND } from "../constants/clinical-record-upload.constants"
import { FileBinaryRepository } from "../repositories/file-binary.repository"
import { UploadAlertRepository } from "../repositories/upload-alert.repository"
import { UploadTaskRepository } from "../repositories/upload-task.repository"
import { uploadAlertEventOf } from "../utils/upload-alert"
import {
	administrator,
	asWorker,
	databaseOf,
	ENCOUNTER_RESOURCE_ID,
	openTasksOf,
	queuedTask,
	recordedPage,
	recordedPhoto,
	storedObject,
	taskRow,
	transactionTime,
} from "./sql-fixtures"

const THIS_RUN = "worker-sql-test:1"
const OTHER_RUN = "worker-sql-test:2"
const LEASE_MILLISECONDS = 120_000
const DELAY_MILLISECONDS = 30_000
const COPY_SIZE_BYTES = 3
const ALERT_MESSAGE = "Nahrání selhalo"

afterAll(async () => {
	await administrator.end()
})

// ADR-016 ř. 54, datovy-model.md 4
describe("queue SQL under the worker role", () => {
	it("ADR-016 ř. 54 claims the task waiting longest, leases it and counts the attempt", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = { kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY, objectKind: JOB_OBJECT_KIND.IMAGE }
				return {
					older: await queuedTask(tx, {
						...task,
						objectId: photo.imageId,
						state: JOB_STATE.WAITING,
						runAfterSeconds: -120,
					}),
					newer: await queuedTask(tx, {
						...task,
						objectId: photo.acquisitionId,
						state: JOB_STATE.WAITING,
						runAfterSeconds: -60,
					}),
					later: await queuedTask(tx, {
						...task,
						objectId: photo.encounterId,
						state: JOB_STATE.WAITING,
						runAfterSeconds: 60,
					}),
				}
			},
			async (tx, tasks) => {
				const store = new QueueTaskStore(databaseOf(tx))
				const rule = {
					kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY,
					objectKinds: undefined,
					condition: undefined,
					countsAttempts: true,
				}

				const first = await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)
				const second = await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)
				const third = await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)

				expect([first?.id, second?.id, third]).toEqual([tasks.older, tasks.newer, undefined])
				const claimed = await taskRow(tx, tasks.older)
				const now = await transactionTime(tx)
				expect(claimed).toMatchObject({ state: JOB_STATE.RUNNING, attempts: 1, locked_by: THIS_RUN })
				expect(claimed?.locked_until?.getTime()).toBe(now.getTime() + LEASE_MILLISECONDS)
				expect((await taskRow(tx, tasks.later))?.state).toBe(JOB_STATE.WAITING)
			},
		)
	})

	it("ADR-016 ř. 54 takes over a running task whose lease ran out and leaves a held one alone", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = {
					kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
					objectKind: JOB_OBJECT_KIND.IMAGE,
					state: JOB_STATE.RUNNING,
					runAfterSeconds: -300,
					lockedBy: OTHER_RUN,
				}
				return {
					held: await queuedTask(tx, { ...task, objectId: photo.imageId, lockedUntilSeconds: 60 }),
					abandoned: await queuedTask(tx, { ...task, objectId: photo.acquisitionId, lockedUntilSeconds: -1 }),
				}
			},
			async (tx, tasks) => {
				const store = new QueueTaskStore(databaseOf(tx))
				const rule = {
					kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
					objectKinds: undefined,
					condition: undefined,
					countsAttempts: true,
				}

				const taken = await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)

				expect(taken?.id).toBe(tasks.abandoned)
				expect(await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)).toBeUndefined()
				expect((await taskRow(tx, tasks.held))?.locked_by).toBe(OTHER_RUN)
			},
		)
	})

	it("datovy-model.md 4 renews a lease only while this run holds it and before it runs out", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = {
					kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
					objectKind: JOB_OBJECT_KIND.IMAGE,
					state: JOB_STATE.RUNNING,
					runAfterSeconds: -300,
				}
				return {
					held: await queuedTask(tx, { ...task, objectId: photo.imageId, lockedBy: THIS_RUN, lockedUntilSeconds: 10 }),
					expired: await queuedTask(tx, {
						...task,
						objectId: photo.acquisitionId,
						lockedBy: THIS_RUN,
						lockedUntilSeconds: -1,
					}),
					foreign: await queuedTask(tx, {
						...task,
						objectId: photo.encounterId,
						lockedBy: OTHER_RUN,
						lockedUntilSeconds: 10,
					}),
				}
			},
			async (tx, tasks) => {
				const store = new QueueTaskStore(databaseOf(tx))
				const leaseOf = (taskId: string) => ({ taskId, lockedBy: THIS_RUN, leaseMilliseconds: LEASE_MILLISECONDS })

				expect(await store.renewLease(leaseOf(tasks.held))).toBe(true)
				expect(await store.renewLease(leaseOf(tasks.expired))).toBe(false)
				expect(await store.renewLease(leaseOf(tasks.foreign))).toBe(false)
				const now = await transactionTime(tx)
				expect((await taskRow(tx, tasks.held))?.locked_until?.getTime()).toBe(now.getTime() + LEASE_MILLISECONDS)
			},
		)
	})

	it("CAP-021-R31 merges a second request into the open task and keeps a running one for another round", async () => {
		await asWorker(
			async (tx) => ({ photo: await recordedPhoto(tx), page: await recordedPage(tx) }),
			async (tx, { photo, page }) => {
				const store = new QueueTaskStore(databaseOf(tx))
				const write = {
					kind: JOB_KIND.CLINICAL_RECORD_WRITE,
					objectKind: JOB_OBJECT_KIND.IMAGE,
					objectId: photo.imageId,
				}
				const pageWrite = { ...write, objectKind: JOB_OBJECT_KIND.DOCUMENT_PAGE, objectId: page.pageId }
				const rule = {
					kind: JOB_KIND.CLINICAL_RECORD_WRITE,
					objectKinds: undefined,
					condition: undefined,
					countsAttempts: true,
				}

				await store.enqueue(tx, write)
				await store.enqueue(tx, write)
				expect(await openTasksOf(tx, photo.imageId)).toBe(1)

				await tx`UPDATE queue_task SET run_after = now() - interval '1 minute'`
				const held = await store.claim(rule, THIS_RUN, LEASE_MILLISECONDS)
				if (held === undefined) {
					throw new Error("no write task was claimed")
				}
				await store.enqueue(tx, write)
				await store.completeUnlessRequestedAgain(tx, held)
				expect(await taskRow(tx, held.id)).toMatchObject({ state: JOB_STATE.WAITING, locked_by: null })

				await store.enqueue(tx, pageWrite)
				await tx`UPDATE queue_task SET run_after = now() - interval '1 minute' WHERE object_id = ${page.pageId}`
				const pageTask = await store.claim(
					{ ...rule, objectKinds: [JOB_OBJECT_KIND.DOCUMENT_PAGE] },
					THIS_RUN,
					LEASE_MILLISECONDS,
				)
				if (pageTask === undefined) {
					throw new Error("no page write task was claimed")
				}
				await store.completeUnlessRequestedAgain(tx, pageTask)
				expect(await taskRow(tx, pageTask.id)).toMatchObject({ state: JOB_STATE.DONE, locked_by: null })
			},
		)
	})

	it("ADR-050 bod 10 puts a failed attempt back after its delay and counts an unknown outcome", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = {
					kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
					objectKind: JOB_OBJECT_KIND.IMAGE,
					state: JOB_STATE.RUNNING,
					runAfterSeconds: -300,
					lockedBy: THIS_RUN,
					lockedUntilSeconds: 60,
				}
				return {
					transient: await queuedTask(tx, { ...task, objectId: photo.imageId }),
					unknown: await queuedTask(tx, { ...task, objectId: photo.acquisitionId }),
					failed: await queuedTask(tx, { ...task, objectId: photo.encounterId }),
				}
			},
			async (tx, tasks) => {
				const store = new QueueTaskStore(databaseOf(tx))

				await store.retryLater(tasks.transient, DELAY_MILLISECONDS)
				await store.retryAfterUnknownOutcome(tasks.unknown, DELAY_MILLISECONDS)
				await store.fail(tx, tasks.failed)

				const now = await transactionTime(tx)
				expect(await taskRow(tx, tasks.transient)).toMatchObject({
					state: JOB_STATE.WAITING,
					unknown_outcomes: 0,
					locked_by: null,
					locked_until: null,
					run_after: new Date(now.getTime() + DELAY_MILLISECONDS),
				})
				expect(await taskRow(tx, tasks.unknown)).toMatchObject({ state: JOB_STATE.WAITING, unknown_outcomes: 1 })
				expect(await taskRow(tx, tasks.failed)).toMatchObject({ state: JOB_STATE.FAILED, locked_by: null })
			},
		)
	})
})

// CAP-021-R36, CAP-021-R40
describe("upload SQL under the worker role", () => {
	it("CAP-021-R40 claims the upload of a photo only once its viewing copy is made", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = { objectKind: JOB_OBJECT_KIND.IMAGE, objectId: photo.imageId, state: JOB_STATE.WAITING }
				return {
					copy: await queuedTask(tx, { ...task, kind: UPLOAD_JOB_KIND.VIEWING_COPY, runAfterSeconds: -60 }),
					upload: await queuedTask(tx, { ...task, kind: UPLOAD_JOB_KIND.BINARY_UPLOAD, runAfterSeconds: -120 }),
				}
			},
			async (tx, tasks) => {
				const repository = new UploadTaskRepository(databaseOf(tx))
				const uploadRule = repository.claimRuleOf(UPLOAD_JOB_KIND.BINARY_UPLOAD)

				expect(await repository.queue.claim(uploadRule, THIS_RUN, LEASE_MILLISECONDS)).toBeUndefined()
				const copy = await repository.queue.claim(
					repository.claimRuleOf(UPLOAD_JOB_KIND.VIEWING_COPY),
					THIS_RUN,
					LEASE_MILLISECONDS,
				)
				expect(copy?.id).toBe(tasks.copy)
				expect(await repository.queue.claim(uploadRule, THIS_RUN, LEASE_MILLISECONDS)).toBeUndefined()

				await repository.queue.complete(tx, tasks.copy)

				expect((await repository.queue.claim(uploadRule, THIS_RUN, LEASE_MILLISECONDS))?.id).toBe(tasks.upload)
			},
		)
	})

	it("CAP-021-R36 finds a photo with its original, thumbnail and the encounter in the clinical record", async () => {
		await asWorker(recordedPhoto, async (tx, photo) => {
			const file = await new FileBinaryRepository(databaseOf(tx)).find(JOB_OBJECT_KIND.IMAGE, photo.imageId)

			expect(file).toEqual({
				kind: JOB_OBJECT_KIND.IMAGE,
				fileId: photo.imageId,
				recordId: photo.acquisitionId,
				ownerReference: `Encounter/${ENCOUNTER_RESOURCE_ID}`,
				original: {
					binaryObjectId: photo.original.id,
					sizeBytes: photo.original.sizeBytes,
					sha256: photo.original.sha256,
					clinicalRecordBinaryId: null,
					isUploaded: false,
				},
				thumbnail: expect.objectContaining({ binaryObjectId: photo.thumbnail.id, isUploaded: false }),
				viewingCopy: undefined,
			})
		})
	})

	it("CAP-021-R36 finds a page of a scanned document with its renditions and the encounter", async () => {
		await asWorker(recordedPage, async (tx, page) => {
			const file = await new FileBinaryRepository(databaseOf(tx)).find(JOB_OBJECT_KIND.DOCUMENT_PAGE, page.pageId)

			expect(file).toMatchObject({
				kind: JOB_OBJECT_KIND.DOCUMENT_PAGE,
				fileId: page.pageId,
				recordId: page.documentId,
				ownerReference: `Encounter/${ENCOUNTER_RESOURCE_ID}`,
				original: { binaryObjectId: page.original.id },
				thumbnail: { binaryObjectId: page.thumbnail.id },
				viewingCopy: undefined,
			})
		})
	})

	it("CAP-021-S29 remembers the Binary, confirms the upload and keeps the first confirmation", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				await tx`
					UPDATE binary_object SET clinical_record_uploaded_at = now() - interval '1 day' WHERE id = ${photo.thumbnail.id}
				`
				return photo
			},
			async (tx, photo) => {
				const files = new FileBinaryRepository(databaseOf(tx))

				await files.rememberBinaryId(photo.original.id, "binary-1")
				await files.confirmUpload(photo.original.id)
				await files.confirmUpload(photo.thumbnail.id)

				const file = await files.find(JOB_OBJECT_KIND.IMAGE, photo.imageId)
				expect(file?.original).toMatchObject({ clinicalRecordBinaryId: "binary-1", isUploaded: true })
				const [thumbnail] = await tx<{ uploaded_at: Date }[]>`
					SELECT clinical_record_uploaded_at AS uploaded_at FROM binary_object WHERE id = ${photo.thumbnail.id}
				`
				const now = await transactionTime(tx)
				expect(thumbnail?.uploaded_at.getTime()).toBeLessThan(now.getTime())
			},
		)
	})

	it("CAP-021-R40 attaches the viewing copy to the photo", async () => {
		await asWorker(recordedPhoto, async (tx, photo) => {
			const files = new FileBinaryRepository(databaseOf(tx))
			const copy = { binaryObjectId: randomUUID(), sizeBytes: COPY_SIZE_BYTES, sha256: photo.original.sha256 }

			await files.attachViewingCopy(tx, JOB_OBJECT_KIND.IMAGE, photo.imageId, copy)

			const file = await files.find(JOB_OBJECT_KIND.IMAGE, photo.imageId)
			expect(file?.viewingCopy).toEqual({
				binaryObjectId: copy.binaryObjectId,
				sizeBytes: copy.sizeBytes,
				sha256: copy.sha256,
				clinicalRecordBinaryId: null,
				isUploaded: false,
			})
		})
	})

	it("CAP-021-R40 attaches the viewing copy to a page of a scanned document", async () => {
		await asWorker(recordedPage, async (tx, page) => {
			const files = new FileBinaryRepository(databaseOf(tx))
			const copy = { binaryObjectId: randomUUID(), sizeBytes: COPY_SIZE_BYTES, sha256: page.original.sha256 }

			await files.attachViewingCopy(tx, JOB_OBJECT_KIND.DOCUMENT_PAGE, page.pageId, copy)

			expect((await files.find(JOB_OBJECT_KIND.DOCUMENT_PAGE, page.pageId))?.viewingCopy?.binaryObjectId).toBe(
				copy.binaryObjectId,
			)
		})
	})

	it("CAP-028-R15 raises one alert per failed task, resolves it and records it in the audit trail", async () => {
		await asWorker(
			async (tx) => {
				const photo = await recordedPhoto(tx)
				const task = await queuedTask(tx, {
					kind: UPLOAD_JOB_KIND.BINARY_UPLOAD,
					objectKind: JOB_OBJECT_KIND.IMAGE,
					objectId: photo.imageId,
					state: JOB_STATE.FAILED,
					runAfterSeconds: -60,
				})
				return { photo, task }
			},
			async (tx, { photo, task }) => {
				const alerts = new UploadAlertRepository()
				const [head] = await tx<{ hash: string }[]>`SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1`

				const alertId = await alerts.raiseForTask(tx, UPLOAD_ALERT_KIND.UPLOAD_FAILED, task, ALERT_MESSAGE)
				const again = await alerts.raiseForTask(tx, UPLOAD_ALERT_KIND.UPLOAD_FAILED, task, ALERT_MESSAGE)
				if (alertId === undefined) {
					throw new Error("no alert was raised")
				}
				const file = { kind: JOB_OBJECT_KIND.IMAGE, fileId: photo.imageId, recordId: photo.acquisitionId }
				const event = uploadAlertEventOf({
					alertId,
					kind: UPLOAD_ALERT_KIND.UPLOAD_FAILED,
					message: ALERT_MESSAGE,
					taskId: task,
					file,
				})
				const record = await new AuditRepository().appendSystemJob(tx, event, await transactionTime(tx))
				await alerts.resolveForTask(tx, task)
				const reraised = await alerts.raiseForTask(tx, UPLOAD_ALERT_KIND.UPLOAD_FAILED, task, ALERT_MESSAGE)

				expect(again).toBeUndefined()
				expect(reraised).toBeDefined()
				expect(reraised).not.toBe(alertId)
				expect(record.previousHash).toBe(head?.hash ?? NO_PREVIOUS_HASH)
				const [written] = await tx<{ object_id: string }[]>`SELECT object_id FROM audit WHERE id = ${record.id}`
				expect(written?.object_id).toBe(alertId)
			},
		)
	})
})

// CAP-021-R36, CAP-021-R39, datovy-model.md 4
describe("upload of the PDF of a scanned document under the worker role", () => {
	async function documentWithPdf(tx: Parameters<Parameters<typeof asWorker>[0]>[0]) {
		const page = await recordedPage(tx)
		const pdf = await storedObject(tx, "pdf")
		await tx`UPDATE document SET output_pdf_binary_object_id = ${pdf.id} WHERE id = ${page.documentId}`
		return { documentId: page.documentId, pdf }
	}

	it("CAP-021-R39 reads the output PDF of the document as the bytes to upload, under the visit of the record", async () => {
		await asWorker(documentWithPdf, async (tx, { documentId, pdf }) => {
			const file = await new FileBinaryRepository(databaseOf(tx)).find(JOB_OBJECT_KIND.DOCUMENT, documentId)

			expect(file).toEqual({
				kind: JOB_OBJECT_KIND.DOCUMENT,
				fileId: documentId,
				recordId: documentId,
				ownerReference: `Encounter/${ENCOUNTER_RESOURCE_ID}`,
				original: {
					binaryObjectId: pdf.id,
					sizeBytes: pdf.sizeBytes,
					sha256: pdf.sha256,
					clinicalRecordBinaryId: null,
					isUploaded: false,
				},
				thumbnail: undefined,
				viewingCopy: undefined,
			})
		})
	})

	it("CAP-021-R39 lets the upload of bytes claim the PDF of a document", async () => {
		await asWorker(
			async (tx) => {
				const { documentId } = await documentWithPdf(tx)
				return await queuedTask(tx, {
					kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
					objectKind: JOB_OBJECT_KIND.DOCUMENT,
					objectId: documentId,
					state: JOB_STATE.WAITING,
					runAfterSeconds: -1,
				})
			},
			async (tx, taskId) => {
				const tasks = new UploadTaskRepository(databaseOf(tx))
				const uploads = tasks.claimRuleOf(UPLOAD_JOB_KIND.BINARY_UPLOAD)

				expect((await tasks.queue.claim(uploads, THIS_RUN, LEASE_MILLISECONDS))?.id).toBe(taskId)
			},
		)
	})

	it("datovy-model.md 4 refuses a viewing copy task for the PDF of a document", async () => {
		await asWorker(documentWithPdf, async (tx, { documentId }) => {
			await expect(
				tx.savepoint((savepoint) =>
					queuedTask(savepoint, {
						kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY,
						objectKind: JOB_OBJECT_KIND.DOCUMENT,
						objectId: documentId,
						state: JOB_STATE.WAITING,
						runAfterSeconds: 0,
					}),
				),
			).rejects.toThrow("queue_task_object_kind_check")
		})
	})

	it("datovy-model.md 4 lets the worker queue the write of the document resource", async () => {
		await asWorker(documentWithPdf, async (tx, { documentId }) => {
			await new QueueTaskStore(databaseOf(tx)).enqueue(tx, {
				kind: JOB_KIND.CLINICAL_RECORD_WRITE,
				objectKind: JOB_OBJECT_KIND.DOCUMENT,
				objectId: documentId,
			})

			expect(await openTasksOf(tx, documentId)).toBe(1)
		})
	})

	it("CAP-021-R39 finds nothing to upload for a document without a PDF", async () => {
		await asWorker(
			async (tx) => await recordedPage(tx),
			async (tx, page) => {
				expect(await new FileBinaryRepository(databaseOf(tx)).find(JOB_OBJECT_KIND.DOCUMENT, page.documentId)).toBe(
					undefined,
				)
			},
		)
	})
})
