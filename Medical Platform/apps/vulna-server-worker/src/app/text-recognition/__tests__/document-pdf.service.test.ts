import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import { type BinaryStorePort, CONFIGURATION_KEY, MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { BinaryObject } from "../../../libs/binary-store/binary-object"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { DatabaseService } from "../../../libs/database/database.service"
import { MissingBufferError } from "../../clinical-record-upload/errors/missing-buffer.error"
import {
	SANDBOX_PATH,
	TESSDATA_PATH,
	TESSERACT_PATH,
	TEXT_RECOGNITION_FAILURE,
} from "../constants/text-recognition.constants"
import type { DocumentPdfRepository } from "../repositories/document-pdf.repository"
import type { PdfUploadTaskRepository } from "../repositories/pdf-upload-task.repository"
import { DocumentPdfService } from "../services/document-pdf.service"
import type { TesseractService } from "../services/tesseract.service"
import type { DocumentPage, PageReader, TextRecognitionSettings } from "../types/text-recognition.types"

const DOCUMENT_ID = "6a1f3c1e-2d55-4c29-9d1e-0c6a7f5b8e01"
const TITLE = "Propouštěcí zpráva"
const PDF = Buffer.from("%PDF-1.5 recognized")
const TIMEOUT_SECONDS = 120
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024
const EARLIER_PDF: BinaryObject = { binaryObjectId: "earlier-pdf", sizeBytes: 5, sha256: "a".repeat(64) }
const SOI = [0xff, 0xd8]
const EOI = [0xff, 0xd9]
const EXIF = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
const COMMENT = [0xff, 0xfe, 0x00, 0x06, 0x47, 0x50, 0x53, 0x21]
const HIDDEN = [0x68, 0x69, 0x64, 0x64, 0x65, 0x6e]

interface WorldOptions {
	existing?: BinaryObject
	pages?: DocumentPage[]
	attachedMeanwhile?: BinaryObject
}

function pageOf(sequence: number): DocumentPage {
	return { sequence, binaryObjectId: `bytes-${sequence}` }
}

function jpegOf(sequence: number, metadata: readonly number[] = [], trailing: readonly number[] = []): Buffer {
	return Buffer.from([...SOI, ...metadata, 0xff, 0xda, 0x00, 0x02, sequence, ...EOI, ...trailing])
}

class PdfWorld {
	readonly stored = new Map<string, Buffer>()
	readonly recognitions: { pages: string[]; title: string; settings: TextRecognitionSettings }[] = []
	readonly attached: BinaryObject[] = []
	readonly queuedUploads: string[] = []
	readonly transactions: { step: string; tx: unknown }[] = []

	constructor(private readonly options: WorldOptions) {
		for (const page of options.pages ?? []) {
			this.stored.set(page.binaryObjectId, jpegOf(page.sequence))
		}
	}

	service(): DocumentPdfService {
		const configuration = {
			effectiveValues: async () =>
				new Map<string, unknown>([
					[CONFIGURATION_KEY.OCR_TIMEOUT_SECONDS, TIMEOUT_SECONDS],
					[CONFIGURATION_KEY.OCR_MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES],
				]),
		} as unknown as ConfigurationService
		const database = { sql: { begin: async (work: (tx: unknown) => unknown) => await work(Symbol("transaction")) } }
		const documents = {
			findOutputPdf: async () => this.options.existing,
			receivedPagesOf: async () => this.options.pages ?? [],
			attachOutputPdf: async (tx: unknown, _documentId: string, pdf: BinaryObject) => {
				this.transactions.push({ step: "attach", tx })
				this.attached.push(pdf)
				return this.options.attachedMeanwhile
			},
		} as unknown as DocumentPdfRepository
		const uploads = {
			enqueue: async (tx: unknown, documentId: string) => {
				this.transactions.push({ step: "enqueue", tx })
				this.queuedUploads.push(documentId)
			},
		} as unknown as PdfUploadTaskRepository
		const tesseract = {
			pdfOf: async (readers: readonly PageReader[], title: string, settings: TextRecognitionSettings) => {
				const pages: string[] = []
				for (const read of readers) {
					pages.push(Buffer.from(await read()).toString("hex"))
				}
				this.recognitions.push({ pages, title, settings })
				return PDF
			},
		} as unknown as TesseractService
		const binaryStore: BinaryStorePort = {
			put: async (key, content) => {
				this.stored.set(key, await buffer(content))
			},
			get: async (key) => Readable.from(this.stored.get(key) ?? Buffer.alloc(0)),
			delete: async (key) => {
				this.stored.delete(key)
			},
			exists: async (key) => this.stored.has(key),
		}
		return new DocumentPdfService(
			database as unknown as DatabaseService,
			documents,
			uploads,
			configuration,
			tesseract,
			binaryStore,
		)
	}
}

describe("DocumentPdfService", () => {
	it("CAP-022-R07 hands back the stored PDF and never builds it again", async () => {
		const world = new PdfWorld({ existing: EARLIER_PDF, pages: [pageOf(1)] })

		expect(await world.service().outputPdfOf(DOCUMENT_ID, TITLE)).toEqual(EARLIER_PDF)
		expect(world.recognitions).toHaveLength(0)
		expect(world.queuedUploads).toEqual([])
	})

	it("CAP-022-R05 recognizes the pages in order and stores one PDF with its SHA-256", async () => {
		const world = new PdfWorld({ pages: [pageOf(1), pageOf(2)] })

		const stored = await world.service().outputPdfOf(DOCUMENT_ID, TITLE)

		expect(world.recognitions.map((recognition) => recognition.pages)).toEqual([
			[jpegOf(1).toString("hex"), jpegOf(2).toString("hex")],
		])
		expect(stored.sizeBytes).toBe(PDF.length)
		expect(stored.sha256).toBe(createHash("sha256").update(PDF).digest("hex"))
		expect(world.stored.get(stored.binaryObjectId)).toEqual(PDF)
		expect(world.attached).toEqual([stored])
	})

	it("CAP-021-R36 queues the upload of the PDF in the transaction that stores the PDF", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)] })

		await world.service().outputPdfOf(DOCUMENT_ID, TITLE)

		expect(world.queuedUploads).toEqual([DOCUMENT_ID])
		const [attach, enqueue] = world.transactions
		expect([attach?.step, enqueue?.step]).toEqual(["attach", "enqueue"])
		expect(enqueue?.tx).toBe(attach?.tx)
	})

	it("CAP-022-R16 puts the title it was given into the PDF", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)] })

		await world.service().outputPdfOf(DOCUMENT_ID, TITLE)

		expect(world.recognitions[0]?.title).toBe(TITLE)
	})

	it("konfigurace-a-profily.md 2.7 takes the limits from the configuration, ADR-018 the tool from the image", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)] })

		await world.service().outputPdfOf(DOCUMENT_ID, TITLE)

		expect(world.recognitions[0]?.settings).toEqual({
			sandboxPath: SANDBOX_PATH,
			tesseractPath: TESSERACT_PATH,
			tessdataPath: TESSDATA_PATH,
			timeoutMilliseconds: TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND,
			memoryLimitBytes: MEMORY_LIMIT_BYTES,
		})
	})

	it("NAB-479 hands the tool the pages without Exif, comments and bytes after the image", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)] })
		world.stored.set("bytes-1", jpegOf(1, [...EXIF, ...COMMENT], HIDDEN))

		await world.service().outputPdfOf(DOCUMENT_ID, TITLE)

		expect(world.recognitions[0]?.pages).toEqual([jpegOf(1).toString("hex")])
	})

	it("NAB-479 refuses to recognize a page whose metadata cannot be removed", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)] })
		world.stored.set("bytes-1", Buffer.from("not a jpeg"))

		await expect(world.service().outputPdfOf(DOCUMENT_ID, TITLE)).rejects.toMatchObject({
			failure: TEXT_RECOGNITION_FAILURE.INVALID_PAGE,
		})
		expect(world.recognitions).toHaveLength(0)
	})

	it("CAP-022-R07 keeps the PDF stored meanwhile and drops its own bytes", async () => {
		const world = new PdfWorld({ pages: [pageOf(1)], attachedMeanwhile: EARLIER_PDF })

		expect(await world.service().outputPdfOf(DOCUMENT_ID, TITLE)).toEqual(EARLIER_PDF)
		expect([...world.stored.keys()]).toEqual(["bytes-1"])
		expect(world.queuedUploads).toEqual([])
	})

	it("CAP-021-R25 refuses a document whose pages are not numbered 1 to N", async () => {
		const world = new PdfWorld({ pages: [pageOf(1), pageOf(3)] })

		await expect(world.service().outputPdfOf(DOCUMENT_ID, TITLE)).rejects.toThrow("no complete pages")
		expect(world.recognitions).toHaveLength(0)
	})

	it("CAP-021-R25 refuses a document without pages", async () => {
		const world = new PdfWorld({ pages: [] })

		await expect(world.service().outputPdfOf(DOCUMENT_ID, TITLE)).rejects.toThrow("no complete pages")
	})

	it("CAP-021-R25 refuses to recognize when the buffer lost a page", async () => {
		const world = new PdfWorld({ pages: [pageOf(1), pageOf(2)] })
		world.stored.delete("bytes-2")

		await expect(world.service().outputPdfOf(DOCUMENT_ID, TITLE)).rejects.toBeInstanceOf(MissingBufferError)
		expect(world.recognitions).toHaveLength(0)
	})
})
