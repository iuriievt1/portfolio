import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { StoredFileRow } from "../types/image.types"

// CAP-021-R36, CAP-020-R22
function confirmedBinaryIdOf(
	sql: postgres.Sql,
	object: postgres.PendingQuery<postgres.Row[]>,
): postgres.PendingQuery<postgres.Row[]> {
	return sql`CASE WHEN ${object}.clinical_record_uploaded_at IS NULL THEN NULL ELSE ${object}.clinical_record_binary_id END`
}

// CAP-020-R15, CAP-021-R40
function viewingCopyColumns(sql: postgres.Sql): postgres.PendingQuery<postgres.Row[]> {
	return sql`viewing_copy.id AS viewing_copy_binary_object_id,
		viewing_copy.buffer_deleted_at AS viewing_copy_buffer_deleted_at,
		${confirmedBinaryIdOf(sql, sql`viewing_copy`)} AS viewing_copy_clinical_record_binary_id`
}

// datovy-model.md 2, datovy-model.md 4, CAP-020-R22
@Injectable()
export class StoredFileRepository {
	constructor(private readonly database: DatabaseService) {}

	async image(imageId: string): Promise<StoredFileRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<StoredFileRow[]>`
			SELECT image.id, image.acquisition_id, acquisition.patient_id, acquisition.encounter_id, acquisition.state,
				acquisition.operator_user_id, acquisition.department_id, image.status,
				original.id AS binary_object_id, original.buffer_deleted_at,
				${confirmedBinaryIdOf(sql, sql`original`)} AS clinical_record_binary_id,
				thumbnail_object.id AS thumbnail_binary_object_id,
				thumbnail_object.buffer_deleted_at AS thumbnail_buffer_deleted_at,
				${confirmedBinaryIdOf(sql, sql`thumbnail_object`)} AS thumbnail_clinical_record_binary_id,
				${viewingCopyColumns(sql)}
			FROM image
			JOIN acquisition ON acquisition.id = image.acquisition_id
			LEFT JOIN binary_object original ON original.id = image.binary_object_id
			LEFT JOIN thumbnail ON thumbnail.image_id = image.id
			LEFT JOIN binary_object thumbnail_object ON thumbnail_object.id = thumbnail.binary_object_id
			LEFT JOIN binary_object viewing_copy ON viewing_copy.id = image.viewing_copy_binary_object_id
			WHERE image.id = ${imageId}
		`
		return row
	}

	async documentPage(pageId: string): Promise<StoredFileRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<StoredFileRow[]>`
			SELECT page.id, document.acquisition_id, acquisition.patient_id, acquisition.encounter_id, acquisition.state,
				acquisition.operator_user_id, acquisition.department_id, page.status,
				original.id AS binary_object_id, original.buffer_deleted_at,
				${confirmedBinaryIdOf(sql, sql`original`)} AS clinical_record_binary_id,
				thumbnail_object.id AS thumbnail_binary_object_id,
				thumbnail_object.buffer_deleted_at AS thumbnail_buffer_deleted_at,
				${confirmedBinaryIdOf(sql, sql`thumbnail_object`)} AS thumbnail_clinical_record_binary_id,
				${viewingCopyColumns(sql)}
			FROM document_page page
			JOIN document ON document.id = page.document_id
			JOIN acquisition ON acquisition.id = document.acquisition_id
			LEFT JOIN binary_object original ON original.id = page.binary_object_id
			LEFT JOIN binary_object thumbnail_object ON thumbnail_object.id = page.thumbnail_binary_object_id
			LEFT JOIN binary_object viewing_copy ON viewing_copy.id = page.viewing_copy_binary_object_id
			WHERE page.id = ${pageId}
		`
		return row
	}
}
