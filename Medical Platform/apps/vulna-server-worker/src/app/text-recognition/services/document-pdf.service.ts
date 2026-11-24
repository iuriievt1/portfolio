import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import {
	type BinaryStorePort,
	CONFIGURATION_KEY,
	MILLISECONDS_PER_SECOND,
	requiredIntegerOf,
} from "@ansora/core-server"
import { withoutMetadata } from "@ansora/vulna-domain"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { type BinaryObject, binaryObjectOf } from "../../../libs/binary-store/binary-object"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { MissingBufferError } from "../../clinical-record-upload/errors/missing-buffer.error"
import {
	SANDBOX_PATH,
	TESSDATA_PATH,
	TESSERACT_PATH,
	TEXT_RECOGNITION_FAILURE,
} from "../constants/text-recognition.constants"
import { TextRecognitionError } from "../errors/text-recognition.error"
import { DocumentPdfRepository } from "../repositories/document-pdf.repository"
import { PdfUploadTaskRepository } from "../repositories/pdf-upload-task.repository"
import type { DocumentPage, TextRecognitionSettings } from "../types/text-recognition.types"
import { TesseractService } from "./tesseract.service"

// CAP-022-R05, CAP-022-R07, CAP-022-R16, ADR-018
@Injectable()
export class DocumentPdfService {
	private readonly logger = new Logger(DocumentPdfService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly documents: DocumentPdfRepository,
		private readonly uploads: PdfUploadTaskRepository,
		private readonly configuration: ConfigurationService,
		private readonly tesseract: TesseractService,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {}

	async outputPdfOf(documentId: string, title: string): Promise<BinaryObject> {
		const existing = await this.documents.findOutputPdf(documentId)
		if (existing !== undefined) {
			return existing
		}
		const pages = await this.completePagesOf(documentId)
		const readers = pages.map((page) => () => this.cleanedPageOf(documentId, page))
		const pdf = await this.tesseract.pdfOf(readers, title, await this.settings())
		return await this.stored(documentId, pdf)
	}

	// CAP-021-R25, backend.md 5
	private async completePagesOf(documentId: string): Promise<DocumentPage[]> {
		const pages = await this.documents.receivedPagesOf(documentId)
		if (pages.length === 0 || pages.some((page, index) => page.sequence !== index + 1)) {
			throw new Error(`document ${documentId} has no complete pages numbered from 1`)
		}
		for (const page of pages) {
			if (!(await this.binaryStore.exists(page.binaryObjectId))) {
				throw new MissingBufferError(page.binaryObjectId)
			}
		}
		return pages
	}

	// NAB-479, CAP-015-R14, CAP-021-R07
	private async cleanedPageOf(documentId: string, page: DocumentPage): Promise<Uint8Array> {
		const cleaned = withoutMetadata(await buffer(await this.binaryStore.get(page.binaryObjectId)))
		if (cleaned === undefined) {
			throw new TextRecognitionError(
				TEXT_RECOGNITION_FAILURE.INVALID_PAGE,
				`page ${page.sequence} of document ${documentId} is not a whole JPEG stream`,
			)
		}
		return cleaned
	}

	// CAP-022-R07, CAP-021-R39, CAP-021-R36, CAP-022-R17
	private async stored(documentId: string, pdf: Buffer): Promise<BinaryObject> {
		const created = binaryObjectOf(pdf)
		await this.binaryStore.put(created.binaryObjectId, Readable.from(pdf))
		const earlier = await this.database.sql.begin(async (tx) => {
			const attached = await this.documents.attachOutputPdf(tx, documentId, created)
			if (attached === undefined) {
				await this.uploads.enqueue(tx, documentId)
			}
			return attached
		})
		if (earlier === undefined) {
			this.logger.log(`Made PDF ${created.binaryObjectId} of document ${documentId}`)
			return created
		}
		await this.binaryStore.delete(created.binaryObjectId)
		this.logger.warn(
			`Document ${documentId} already has PDF ${earlier.binaryObjectId}; PDF ${created.binaryObjectId} dropped`,
		)
		return earlier
	}

	// CAP-022-R12, konfigurace-a-profily.md 2.7, ADR-018
	private async settings(): Promise<TextRecognitionSettings> {
		const values = await this.configuration.effectiveValues()
		return {
			sandboxPath: SANDBOX_PATH,
			tesseractPath: TESSERACT_PATH,
			tessdataPath: TESSDATA_PATH,
			timeoutMilliseconds: requiredIntegerOf(values, CONFIGURATION_KEY.OCR_TIMEOUT_SECONDS) * MILLISECONDS_PER_SECOND,
			memoryLimitBytes: requiredIntegerOf(values, CONFIGURATION_KEY.OCR_MEMORY_LIMIT_BYTES),
		}
	}
}
