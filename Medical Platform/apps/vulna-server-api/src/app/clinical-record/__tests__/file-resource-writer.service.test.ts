import { JOB_OBJECT_KIND } from "@ansora/core-server"
import {
	CLINICAL_FILE_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalFileResource,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { ImageResourceTaskRepository } from "../repositories/image-resource-task.repository"
import type { PageResourceTaskRepository } from "../repositories/page-resource-task.repository"
import type { FileResourceContentService } from "../services/file-resource-content.service"
import { ImageResourceWriterService } from "../services/image-resource-writer.service"
import { PageResourceWriterService } from "../services/page-resource-writer.service"
import type { ClaimedWriteTask, FileResourceObjectKind } from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const FILE_ID = "11111111-1111-4111-8111-111111111111"
const RESOURCE_ID = "document-reference-1"
const TASK: ClaimedWriteTask = {
	id: "33333333-3333-4333-8333-333333333333",
	objectId: FILE_ID,
	attempts: 1,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}
const FILE = { kind: CLINICAL_FILE_KIND.IMAGE, fileId: FILE_ID } as ClinicalFileResource

function detachingText(detaching: readonly string[]): string {
	return detaching.length === 0 ? "" : ` detaching ${detaching.join(", ")}`
}

function harness(options: {
	store: Partial<ClinicalRecordStorePort>
	file?: ClinicalFileResource | undefined
	detaching?: readonly string[]
}) {
	const steps: string[] = []
	const queue = {
		claim: async () => TASK,
		retryLater: async (taskId: string) => {
			steps.push(`retry ${taskId}`)
		},
		retryAfterUnknownOutcome: async (taskId: string) => {
			steps.push(`retry unknown ${taskId}`)
		},
	}
	const tasks = {
		queue,
		complete: async (task: ClaimedWriteTask) => {
			steps.push(`complete ${task.id}`)
		},
		fail: async (task: ClaimedWriteTask) => {
			steps.push(`fail ${task.id}`)
		},
	}
	const content = {
		contentOf: async (kind: FileResourceObjectKind, fileId: string) => {
			steps.push(`build ${kind} ${fileId}`)
			const file = "file" in options ? options.file : FILE
			return file === undefined ? undefined : { resource: file, detaching: options.detaching ?? [] }
		},
		remember: async (kind: FileResourceObjectKind, fileId: string, resourceId: string, detaching: string[]) => {
			steps.push(`remember ${kind} ${fileId} as ${resourceId}${detachingText(detaching)}`)
		},
	} as unknown as FileResourceContentService
	const stores = storesWith(options.store)
	return {
		images: new ImageResourceWriterService(tasks as unknown as ImageResourceTaskRepository, stores, content),
		pages: new PageResourceWriterService(tasks as unknown as PageResourceTaskRepository, stores, content),
		steps,
	}
}

describe("source of a photo or page written after its upload CAP-021-R37", () => {
	it("CAP-021-S30 writes the source of the photo, remembers its id and closes the task", async () => {
		const written: ClinicalFileResource[] = []
		const run = harness({
			store: {
				recordFileResource: async (file) => {
					written.push(file)
					return RESOURCE_ID
				},
			},
		})

		await run.images.writeNext()

		expect(written).toEqual([FILE])
		expect(run.steps).toEqual([
			`build ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID}`,
			`remember ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID} as ${RESOURCE_ID}`,
			`complete ${TASK.id}`,
		])
	})

	it("ADR-050 bod 14 detaches the files the written source no longer refers to", async () => {
		const run = harness({ store: { recordFileResource: async () => RESOURCE_ID }, detaching: ["object-original"] })

		await run.images.writeNext()

		expect(run.steps).toContain(
			`remember ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID} as ${RESOURCE_ID} detaching object-original`,
		)
	})

	it("CAP-021-S35 writes the source of a scanned page under its own kind", async () => {
		const run = harness({ store: { recordFileResource: async () => RESOURCE_ID } })

		await run.pages.writeNext()

		expect(run.steps[0]).toBe(`build ${JOB_OBJECT_KIND.DOCUMENT_PAGE} ${FILE_ID}`)
	})

	it("CAP-021-R37 fails the task when the server cannot build the source, and writes nothing", async () => {
		const written: ClinicalFileResource[] = []
		const run = harness({
			store: {
				recordFileResource: async (file) => {
					written.push(file)
					return RESOURCE_ID
				},
			},
			file: undefined,
		})

		await run.images.writeNext()

		expect(written).toEqual([])
		expect(run.steps.at(-1)).toBe(`fail ${TASK.id}`)
	})

	it("ADR-050 bod 10 waits while the store is unavailable and stops on a rejection", async () => {
		const unavailable = harness({
			store: {
				recordFileResource: async () => {
					throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "down")
				},
			},
		})
		const rejected = harness({
			store: {
				recordFileResource: async () => {
					throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid")
				},
			},
		})

		await unavailable.images.writeNext()
		await rejected.images.writeNext()

		expect(unavailable.steps.at(-1)).toBe(`retry ${TASK.id}`)
		expect(rejected.steps.at(-1)).toBe(`fail ${TASK.id}`)
	})
})
