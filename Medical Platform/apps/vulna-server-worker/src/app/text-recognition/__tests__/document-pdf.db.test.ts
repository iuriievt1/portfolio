import { createHash, randomUUID } from "node:crypto"
import { JOB_KIND, JOB_OBJECT_KIND } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import type { BinaryObject } from "../../../libs/binary-store/binary-object"
import {
	administrator,
	asWorker,
	databaseOf,
	openTasksOf,
	type RecordedPage,
	recordedPage,
	storedObject,
} from "../../clinical-record-upload/__tests__/sql-fixtures"
import { DocumentPdfRepository } from "../repositories/document-pdf.repository"
import { PdfUploadTaskRepository } from "../repositories/pdf-upload-task.repository"

afterAll(async () => {
	await administrator.end()
})

type Transaction = postgres.TransactionSql

const RECEIVED = "received"
const REMOVED = "removed"

function pdfOf(name: string): BinaryObject {
	return {
		binaryObjectId: randomUUID(),
		sizeBytes: name.length,
		sha256: createHash("sha256").update(name).digest("hex"),
	}
}

async function addPage(tx: Transaction, page: RecordedPage, sequence: number, status: string): Promise<string | null> {
	const object = status === RECEIVED ? await storedObject(tx, `page ${sequence}`) : undefined
	await tx`
		INSERT INTO document_page (id, document_id, file_key, sequence, status, binary_object_id, received_at)
		VALUES (${randomUUID()}, ${page.documentId}, ${randomUUID()}, ${sequence}, ${status}, ${object?.id ?? null},
			${object === undefined ? null : new Date()})
	`
	return object?.id ?? null
}

describe("DocumentPdfRepository under the worker role", () => {
	it("CAP-021-R25 reads the received pages of a document in their order", async () => {
		await asWorker(
			async (tx) => {
				const page = await recordedPage(tx)
				const third = await addPage(tx, page, 3, RECEIVED)
				await addPage(tx, page, 2, REMOVED)
				const second = await addPage(tx, page, 2, RECEIVED)
				return { page, second, third }
			},
			async (tx, { page, second, third }) => {
				const pages = await new DocumentPdfRepository(databaseOf(tx)).receivedPagesOf(page.documentId)

				expect(pages).toEqual([
					{ sequence: 1, binaryObjectId: page.original.id },
					{ sequence: 2, binaryObjectId: second },
					{ sequence: 3, binaryObjectId: third },
				])
			},
		)
	})

	it("CAP-022-R07 stores the PDF of a document as its own binary object", async () => {
		await asWorker(
			async (tx) => await recordedPage(tx),
			async (tx, page) => {
				const repository = new DocumentPdfRepository(databaseOf(tx))
				const pdf = pdfOf("first pdf")

				expect(await repository.attachOutputPdf(tx, page.documentId, pdf)).toBeUndefined()
				expect(await repository.findOutputPdf(page.documentId)).toEqual(pdf)
			},
		)
	})

	it("CAP-022-R07 keeps the first PDF of a document and never takes a second", async () => {
		await asWorker(
			async (tx) => await recordedPage(tx),
			async (tx, page) => {
				const repository = new DocumentPdfRepository(databaseOf(tx))
				const first = pdfOf("first pdf")
				const second = pdfOf("second pdf")
				await repository.attachOutputPdf(tx, page.documentId, first)

				expect(await repository.attachOutputPdf(tx, page.documentId, second)).toEqual(first)
				const rows = await tx`SELECT id FROM binary_object WHERE id = ${second.binaryObjectId}`
				expect(rows).toHaveLength(0)
			},
		)
	})

	it("datovy-model.md 4 keeps one open upload of the PDF however often it is queued", async () => {
		await asWorker(
			async (tx) => await recordedPage(tx),
			async (tx, page) => {
				const uploads = new PdfUploadTaskRepository(databaseOf(tx))
				await new DocumentPdfRepository(databaseOf(tx)).attachOutputPdf(tx, page.documentId, pdfOf("pdf"))

				await uploads.enqueue(tx, page.documentId)
				await uploads.enqueue(tx, page.documentId)

				const tasks = await tx<{ kind: string; object_kind: string }[]>`
					SELECT kind, object_kind FROM queue_task WHERE object_id = ${page.documentId}
				`
				expect(tasks).toEqual([{ kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD, object_kind: JOB_OBJECT_KIND.DOCUMENT }])
				expect(await openTasksOf(tx, page.documentId)).toBe(1)
			},
		)
	})

	it("CAP-022-R07 reads no PDF of a document that has none", async () => {
		await asWorker(
			async (tx) => await recordedPage(tx),
			async (tx, page) => {
				expect(await new DocumentPdfRepository(databaseOf(tx)).findOutputPdf(page.documentId)).toBeUndefined()
			},
		)
	})

	it("datovy-model.md 2 attaches no PDF to a document that does not exist", async () => {
		await asWorker(
			async () => undefined,
			async (tx) => {
				const pdf = pdfOf("orphan pdf")

				await expect(new DocumentPdfRepository(databaseOf(tx)).attachOutputPdf(tx, randomUUID(), pdf)).rejects.toThrow(
					"does not exist",
				)
				const rows = await tx`SELECT id FROM binary_object WHERE id = ${pdf.binaryObjectId}`
				expect(rows).toHaveLength(0)
			},
		)
	})
})
