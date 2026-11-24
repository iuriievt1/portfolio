import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import type { RecordFileRow } from "../types/image.types"

// CAP-020-R09, CAP-020-R17, CAP-021-R25, CAP-026-R06, datovy-model.md 4
@Injectable()
export class RecordFileRepository {
	async imagesOf(sql: Executor, acquisitionIds: readonly string[]): Promise<RecordFileRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<RecordFileRow[]>`
			SELECT image.id, image.acquisition_id, image.sequence, image.edit_kind,
				(thumbnail_object.id IS NOT NULL) AS has_thumbnail,
				(original.id IS NOT NULL) AS is_available,
				(image.viewing_copy_binary_object_id IS NOT NULL) AS has_viewing_copy
			FROM image
			LEFT JOIN binary_object original ON original.id = image.binary_object_id
			LEFT JOIN thumbnail ON thumbnail.image_id = image.id
			LEFT JOIN binary_object thumbnail_object ON thumbnail_object.id = thumbnail.binary_object_id
			WHERE image.acquisition_id IN ${sql([...acquisitionIds])} AND image.status = ${FILE_STATUS.RECEIVED}
			ORDER BY image.acquisition_id, image.sequence, image.id
		`
	}

	async pagesOf(sql: Executor, acquisitionIds: readonly string[]): Promise<RecordFileRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<RecordFileRow[]>`
			SELECT page.id, document.acquisition_id, page.sequence, page.edit_kind,
				(thumbnail_object.id IS NOT NULL) AS has_thumbnail,
				(original.id IS NOT NULL) AS is_available,
				(page.viewing_copy_binary_object_id IS NOT NULL) AS has_viewing_copy
			FROM document_page page
			JOIN document ON document.id = page.document_id
			LEFT JOIN binary_object original ON original.id = page.binary_object_id
			LEFT JOIN binary_object thumbnail_object ON thumbnail_object.id = page.thumbnail_binary_object_id
			WHERE document.acquisition_id IN ${sql([...acquisitionIds])} AND page.status = ${FILE_STATUS.RECEIVED}
			ORDER BY document.acquisition_id, page.sequence, page.id
		`
	}
}
