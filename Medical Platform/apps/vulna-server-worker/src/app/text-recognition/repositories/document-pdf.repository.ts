import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { type BinaryObject, insertBinaryObject } from "../../../libs/binary-store/binary-object"
import { FILE_STATUS } from "../../../libs/common/constants/file-status.constants"
import { DatabaseService } from "../../../libs/database/database.service"
import type { DocumentPage, DocumentPageRow, StoredPdfRow } from "../types/text-recognition.types"

function storedPdfOf(row: StoredPdfRow): BinaryObject {
	return { binaryObjectId: row.binary_object_id, sizeBytes: Number(row.size_bytes), sha256: row.sha256 }
}

// datovy-model.md 2, datovy-model.md 4
@Injectable()
export class DocumentPdfRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-022-R07
	async findOutputPdf(documentId: string): Promise<BinaryObject | undefined> {
		return await this.outputPdfIn(this.database.sql, documentId)
	}

	// CAP-021-R25, CAP-022-R05
	async receivedPagesOf(documentId: string): Promise<DocumentPage[]> {
		const rows = await this.database.sql<DocumentPageRow[]>`
			SELECT sequence, binary_object_id
			FROM document_page
			WHERE document_id = ${documentId} AND status = ${FILE_STATUS.RECEIVED}
			ORDER BY sequence
		`
		return rows.map((row) => ({ sequence: row.sequence, binaryObjectId: row.binary_object_id }))
	}

	// CAP-022-R07
	async attachOutputPdf(
		tx: postgres.TransactionSql,
		documentId: string,
		pdf: BinaryObject,
	): Promise<BinaryObject | undefined> {
		const [document] = await tx<{ id: string }[]>`SELECT id FROM document WHERE id = ${documentId} FOR UPDATE`
		if (document === undefined) {
			throw new Error(`document ${documentId} does not exist`)
		}
		const earlier = await this.outputPdfIn(tx, documentId)
		if (earlier !== undefined) {
			return earlier
		}
		await insertBinaryObject(tx, pdf)
		await tx`UPDATE document SET output_pdf_binary_object_id = ${pdf.binaryObjectId} WHERE id = ${documentId}`
		return undefined
	}

	private async outputPdfIn(
		sql: postgres.Sql | postgres.TransactionSql,
		documentId: string,
	): Promise<BinaryObject | undefined> {
		const [row] = await sql<StoredPdfRow[]>`
			SELECT o.id AS binary_object_id, o.size_bytes, o.sha256
			FROM document d
			JOIN binary_object o ON o.id = d.output_pdf_binary_object_id
			WHERE d.id = ${documentId}
		`
		return row === undefined ? undefined : storedPdfOf(row)
	}
}
