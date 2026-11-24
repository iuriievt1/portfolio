import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { DocumentRow, DocumentTitleChoice } from "../types/acquisition-file.types"

const COLUMNS = ["id", "acquisition_id", "title_code", "title_text", "title_code_list_version"] as const

// datovy-model.md 2, CAP-018-R15, CAP-020-R17
@Injectable()
export class DocumentRepository {
	async findByAcquisition(sql: Executor, acquisitionId: string): Promise<DocumentRow | undefined> {
		const [row] = await sql<DocumentRow[]>`SELECT ${sql(COLUMNS)} FROM document WHERE acquisition_id = ${acquisitionId}`
		return row
	}

	// CAP-018-R14, CAP-021-R39
	async insert(tx: postgres.TransactionSql, documentId: string, acquisitionId: string): Promise<void> {
		await tx`INSERT INTO document (id, acquisition_id) VALUES (${documentId}, ${acquisitionId})`
	}

	// CAP-014-R25, ADR-050 (doplnění D33) bod 3
	async rekey(tx: postgres.TransactionSql, acquisitionId: string, documentId: string): Promise<void> {
		await tx`UPDATE document SET id = ${documentId} WHERE acquisition_id = ${acquisitionId}`
	}

	// CAP-018-R15
	async setTitle(tx: postgres.TransactionSql, acquisitionId: string, title: DocumentTitleChoice): Promise<void> {
		const updated = await tx`
			UPDATE document SET
				title_code = ${title.code}, title_text = ${title.text}, title_code_list_version = ${title.codeListVersion}
			WHERE acquisition_id = ${acquisitionId}
		`
		if (updated.count === 0) {
			throw new Error(`the scan ${acquisitionId} has no document`)
		}
	}
}
