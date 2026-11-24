import {
	CLINICAL_RECORD_FAILURE,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
	type ClinicalScannedDocumentPdf,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { DocumentResourceTaskRepository } from "../repositories/document-resource-task.repository"
import { DocumentResourceWriterService } from "../services/document-resource-writer.service"
import type { ScannedDocumentContentService } from "../services/scanned-document-content.service"
import type { ClaimedWriteTask } from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"
const RESOURCE_ID = "document-reference-1"
const TASK: ClaimedWriteTask = {
	id: "33333333-3333-4333-8333-333333333333",
	objectId: DOCUMENT_ID,
	attempts: 1,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}
const DOCUMENT: ClinicalScannedDocumentPdf = {
	acquisitionId: "55555555-5555-4555-8555-555555555555",
	documentId: DOCUMENT_ID,
	patientResourceId: "patient-1",
	department: undefined,
	closedAt: "2026-11-02T09:30:00.000Z",
	author: { userId: "44444444-4444-4444-8444-444444444444", department: undefined },
	title: { code: undefined, text: "Propouštěcí zpráva" },
	pageCount: 3,
	study: { encounterResourceId: "encounter-1" },
	series: { seriesInstanceUid: "2.25.9" },
	studyResourceId: "study-1",
	delivered: undefined,
	pdf: {
		binaryId: "binary-pdf",
		contentType: "application/pdf",
		sizeBytes: 3,
		sha1Base64: "sha1",
		sha256: "a".repeat(64),
	},
}

function harness(options: {
	store: Partial<ClinicalRecordStorePort>
	document?: ClinicalScannedDocumentPdf | undefined
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
		contentOf: async (documentId: string) => {
			steps.push(`build ${documentId}`)
			const document = "document" in options ? options.document : DOCUMENT
			return document === undefined ? undefined : { resource: document, detaching: [] }
		},
		remember: async (documentId: string, resourceId: string) => {
			steps.push(`remember ${documentId} as ${resourceId}`)
		},
	} as unknown as ScannedDocumentContentService
	const writer = new DocumentResourceWriterService(
		tasks as unknown as DocumentResourceTaskRepository,
		storesWith(options.store),
		content,
	)
	return { writer, steps }
}

describe("PDF of a scanned document written after its upload CAP-021-R39", () => {
	it("CAP-021-R39 points the document at its PDF, remembers the resource and closes the task", async () => {
		const written: ClinicalScannedDocumentPdf[] = []
		const run = harness({
			store: {
				recordScannedDocumentPdf: async (document) => {
					written.push(document)
					return RESOURCE_ID
				},
			},
		})

		await run.writer.writeNext()

		expect(written).toEqual([DOCUMENT])
		expect(run.steps).toEqual([
			`build ${DOCUMENT_ID}`,
			`remember ${DOCUMENT_ID} as ${RESOURCE_ID}`,
			`complete ${TASK.id}`,
		])
	})

	it("CAP-021-R39 fails the task when the server cannot build the document, and writes nothing", async () => {
		const written: ClinicalScannedDocumentPdf[] = []
		const run = harness({
			store: {
				recordScannedDocumentPdf: async (document) => {
					written.push(document)
					return RESOURCE_ID
				},
			},
			document: undefined,
		})

		await run.writer.writeNext()

		expect(written).toEqual([])
		expect(run.steps.at(-1)).toBe(`fail ${TASK.id}`)
	})

	it("ADR-050 bod 10 waits while the store is unavailable and stops on a rejection", async () => {
		const unavailable = harness({
			store: {
				recordScannedDocumentPdf: async () => {
					throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "down")
				},
			},
		})
		const rejected = harness({
			store: {
				recordScannedDocumentPdf: async () => {
					throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid")
				},
			},
		})

		await unavailable.writer.writeNext()
		await rejected.writer.writeNext()

		expect(unavailable.steps.at(-1)).toBe(`retry ${TASK.id}`)
		expect(rejected.steps.at(-1)).toBe(`fail ${TASK.id}`)
	})
})
