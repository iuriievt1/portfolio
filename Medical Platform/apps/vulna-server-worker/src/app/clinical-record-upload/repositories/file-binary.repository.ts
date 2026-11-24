import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { type BinaryObject, insertBinaryObject } from "../../../libs/binary-store/binary-object"
import { DatabaseService } from "../../../libs/database/database.service"
import type {
	CopiedObjectKind,
	FileBinaries,
	FileBinariesRow,
	FileObjectKind,
	RenditionRow,
	StoredRendition,
} from "../types/clinical-record-upload.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// datovy-model.md 13.2, backend.md 3.2 X-Security-Context
const ENCOUNTER_RESOURCE = "Encounter"
const ENCOUNTER_LINK = "encounter"

// CAP-021-R40, datovy-model.md 4 „Binární objekt“
const COPIED_FILE_TABLE = {
	[JOB_OBJECT_KIND.IMAGE]: "image",
	[JOB_OBJECT_KIND.DOCUMENT_PAGE]: "document_page",
} as const satisfies Record<CopiedObjectKind, string>

// datovy-model.md 13.2, backend.md 3.2 X-Security-Context
function encounterLinkOf(sql: postgres.Sql): Fragment {
	return sql`LEFT JOIN fhir_resource_link link ON link.resource_type = ${ENCOUNTER_RESOURCE}
		AND link.local_kind = ${ENCOUNTER_LINK} AND link.local_id = a.encounter_id::text`
}

function renditionOf(sql: postgres.Sql, alias: string): Fragment {
	const object = sql(alias)
	return sql`CASE WHEN ${object}.id IS NULL THEN NULL ELSE json_build_object(
		'binary_object_id', ${object}.id,
		'size_bytes', ${object}.size_bytes,
		'sha256', ${object}.sha256,
		'clinical_record_binary_id', ${object}.clinical_record_binary_id,
		'clinical_record_uploaded_at', ${object}.clinical_record_uploaded_at
	) END`
}

function storedOf(row: RenditionRow): StoredRendition {
	return {
		binaryObjectId: row.binary_object_id,
		sizeBytes: row.size_bytes,
		sha256: row.sha256,
		clinicalRecordBinaryId: row.clinical_record_binary_id,
		isUploaded: row.clinical_record_uploaded_at !== null,
	}
}

// datovy-model.md 4 „Binární objekt“, CAP-021-R36, CAP-021-R39, CAP-021-R40
@Injectable()
export class FileBinaryRepository {
	constructor(private readonly database: DatabaseService) {}

	async find<ObjectKind extends FileObjectKind>(
		kind: ObjectKind,
		fileId: string,
	): Promise<FileBinaries<ObjectKind> | undefined> {
		const [row] = await this.rowsOf(kind, fileId)
		if (row === undefined) {
			return undefined
		}
		return {
			kind,
			fileId: row.file_id,
			recordId: row.record_id,
			ownerReference:
				row.encounter_resource_id === null ? undefined : `${ENCOUNTER_RESOURCE}/${row.encounter_resource_id}`,
			original: storedOf(row.original),
			thumbnail: row.thumbnail === null ? undefined : storedOf(row.thumbnail),
			viewingCopy: row.viewing_copy === null ? undefined : storedOf(row.viewing_copy),
		}
	}

	// CAP-021-R36, CAP-021-S29
	async rememberBinaryId(binaryObjectId: string, clinicalRecordBinaryId: string): Promise<void> {
		await this.database.sql`
			UPDATE binary_object SET clinical_record_binary_id = ${clinicalRecordBinaryId} WHERE id = ${binaryObjectId}
		`
	}

	// CAP-021-R36, CAP-026-R18
	async confirmUpload(binaryObjectId: string): Promise<void> {
		await this.database.sql`
			UPDATE binary_object SET clinical_record_uploaded_at = now()
			WHERE id = ${binaryObjectId} AND clinical_record_uploaded_at IS NULL
		`
	}

	// CAP-021-R40
	async attachViewingCopy(
		tx: postgres.TransactionSql,
		kind: CopiedObjectKind,
		fileId: string,
		copy: BinaryObject,
	): Promise<void> {
		await insertBinaryObject(tx, copy)
		const file = tx(COPIED_FILE_TABLE[kind])
		await tx`UPDATE ${file} SET viewing_copy_binary_object_id = ${copy.binaryObjectId} WHERE id = ${fileId}`
	}

	private async rowsOf(kind: FileObjectKind, fileId: string): Promise<FileBinariesRow[]> {
		const sql = this.database.sql
		switch (kind) {
			case JOB_OBJECT_KIND.IMAGE:
				return await this.image(sql, fileId)
			case JOB_OBJECT_KIND.DOCUMENT_PAGE:
				return await this.documentPage(sql, fileId)
			case JOB_OBJECT_KIND.DOCUMENT:
				return await this.documentPdf(sql, fileId)
			default:
				return kind satisfies never
		}
	}

	private async image(sql: postgres.Sql, fileId: string): Promise<FileBinariesRow[]> {
		return await sql<FileBinariesRow[]>`
			SELECT i.id AS file_id, i.acquisition_id AS record_id, link.resource_id AS encounter_resource_id,
				${renditionOf(sql, "o")} AS original, ${renditionOf(sql, "t")} AS thumbnail,
				${renditionOf(sql, "c")} AS viewing_copy
			FROM image i
			JOIN acquisition a ON a.id = i.acquisition_id
			JOIN binary_object o ON o.id = i.binary_object_id
			LEFT JOIN thumbnail th ON th.image_id = i.id
			LEFT JOIN binary_object t ON t.id = th.binary_object_id
			LEFT JOIN binary_object c ON c.id = i.viewing_copy_binary_object_id
			${encounterLinkOf(sql)}
			WHERE i.id = ${fileId}
		`
	}

	private async documentPage(sql: postgres.Sql, fileId: string): Promise<FileBinariesRow[]> {
		return await sql<FileBinariesRow[]>`
			SELECT p.id AS file_id, p.document_id AS record_id, link.resource_id AS encounter_resource_id,
				${renditionOf(sql, "o")} AS original, ${renditionOf(sql, "t")} AS thumbnail,
				${renditionOf(sql, "c")} AS viewing_copy
			FROM document_page p
			JOIN document d ON d.id = p.document_id
			JOIN acquisition a ON a.id = d.acquisition_id
			JOIN binary_object o ON o.id = p.binary_object_id
			LEFT JOIN binary_object t ON t.id = p.thumbnail_binary_object_id
			LEFT JOIN binary_object c ON c.id = p.viewing_copy_binary_object_id
			${encounterLinkOf(sql)}
			WHERE p.id = ${fileId}
		`
	}

	// CAP-021-R36, CAP-021-R39
	private async documentPdf(sql: postgres.Sql, documentId: string): Promise<FileBinariesRow[]> {
		return await sql<FileBinariesRow[]>`
			SELECT d.id AS file_id, d.id AS record_id, link.resource_id AS encounter_resource_id,
				${renditionOf(sql, "o")} AS original, NULL AS thumbnail, NULL AS viewing_copy
			FROM document d
			JOIN acquisition a ON a.id = d.acquisition_id
			JOIN binary_object o ON o.id = d.output_pdf_binary_object_id
			${encounterLinkOf(sql)}
			WHERE d.id = ${documentId}
		`
	}
}
