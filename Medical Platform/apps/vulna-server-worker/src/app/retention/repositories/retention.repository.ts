import { JOB_KIND, JOB_OBJECT_KIND, QueueTaskStore } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { ARTIFACT_SOURCE_KIND } from "../../../libs/common/constants/artifact.constants"
import { FILE_STATUS } from "../../../libs/common/constants/file-status.constants"
import { DatabaseService } from "../../../libs/database/database.service"
import { RETENTION_BATCH_SIZE, STORED_RENDITION } from "../constants/retention.constants"
import type { BufferCopyRow, RetainedFileRow, RetentionPeriods } from "../types/retention.types"

type Executor = postgres.Sql | postgres.TransactionSql
type Fragment = postgres.PendingQuery<postgres.Row[]>

const { IMAGE, DOCUMENT } = ARTIFACT_SOURCE_KIND
const { ORIGINAL, THUMBNAIL, VIEWING_COPY, OUTPUT_PDF, DICOM_FILE } = STORED_RENDITION

// datovy-model.md 5 „Co kotva instance kotví“, CAP-026-R15
function retainedFiles(sql: Executor): Fragment {
	const image = sql`${IMAGE}::text, image.id, image.acquisition_id`
	const page = sql`${DOCUMENT}::text, document.id, document.acquisition_id`
	return sql`
		SELECT ${image}, image.binary_object_id, ${ORIGINAL}::text, ${JOB_OBJECT_KIND.IMAGE}::text, image.id
		FROM image WHERE image.status = ${FILE_STATUS.RECEIVED} AND image.binary_object_id IS NOT NULL
		UNION ALL
		SELECT ${image}, thumbnail.binary_object_id, ${THUMBNAIL}::text, ${JOB_OBJECT_KIND.IMAGE}::text, image.id
		FROM thumbnail JOIN image ON image.id = thumbnail.image_id
		WHERE image.status = ${FILE_STATUS.RECEIVED}
		UNION ALL
		SELECT ${image}, image.viewing_copy_binary_object_id, ${VIEWING_COPY}::text, ${JOB_OBJECT_KIND.IMAGE}::text, image.id
		FROM image WHERE image.status = ${FILE_STATUS.RECEIVED} AND image.viewing_copy_binary_object_id IS NOT NULL
		UNION ALL
		SELECT ${page}, page.binary_object_id, ${ORIGINAL}::text, ${JOB_OBJECT_KIND.DOCUMENT_PAGE}::text, page.id
		FROM document_page page JOIN document ON document.id = page.document_id
		WHERE page.status = ${FILE_STATUS.RECEIVED} AND page.binary_object_id IS NOT NULL
		UNION ALL
		SELECT ${page}, page.thumbnail_binary_object_id, ${THUMBNAIL}::text, ${JOB_OBJECT_KIND.DOCUMENT_PAGE}::text, page.id
		FROM document_page page JOIN document ON document.id = page.document_id
		WHERE page.status = ${FILE_STATUS.RECEIVED} AND page.thumbnail_binary_object_id IS NOT NULL
		UNION ALL
		SELECT ${page}, page.viewing_copy_binary_object_id, ${VIEWING_COPY}::text, ${JOB_OBJECT_KIND.DOCUMENT_PAGE}::text,
			page.id
		FROM document_page page JOIN document ON document.id = page.document_id
		WHERE page.status = ${FILE_STATUS.RECEIVED} AND page.viewing_copy_binary_object_id IS NOT NULL
		UNION ALL
		SELECT ${page}, document.output_pdf_binary_object_id, ${OUTPUT_PDF}::text, ${JOB_OBJECT_KIND.DOCUMENT}::text,
			document.id
		FROM document WHERE document.output_pdf_binary_object_id IS NOT NULL
	`
}

// CAP-026-R03, CAP-026-R04, CAP-026-R15, CAP-026-S10, dorucovaci-jadro.md 6
function anchoredSources(sql: Executor): Fragment {
	return sql`
		SELECT artifact.source_kind, artifact.source_id, max(instance.retention_anchor) AS retention_anchor
		FROM artifact
		JOIN delivery_instance instance ON instance.artifact_id = artifact.id
		GROUP BY artifact.source_kind, artifact.source_id, artifact.acquisition_id
		HAVING bool_and(instance.retention_anchor IS NOT NULL)
			AND NOT EXISTS (
				SELECT 1 FROM delivery
				WHERE delivery.acquisition_id = artifact.acquisition_id
					AND NOT EXISTS (
						SELECT 1 FROM artifact covered
						JOIN delivery_instance confirmed ON confirmed.artifact_id = covered.id
						WHERE covered.source_kind = artifact.source_kind
							AND covered.source_id = artifact.source_id
							AND confirmed.delivery_id = delivery.id
							AND confirmed.retention_anchor IS NOT NULL
					)
			)
	`
}

function anchoredFiles(sql: Executor): Fragment {
	return sql`
		retained (source_kind, source_id, acquisition_id, binary_object_id, rendition, file_kind, file_id) AS (
			${retainedFiles(sql)}
		),
		anchored AS (${anchoredSources(sql)})
	`
}

// CAP-026-R01, CAP-026-R02, CAP-026-R20
function retentionDaysOf(sql: Executor, periods: RetentionPeriods): Fragment {
	return sql`
		CASE retained.rendition
			WHEN ${ORIGINAL} THEN ${periods.originalDays}::int
			WHEN ${OUTPUT_PDF} THEN ${periods.originalDays}::int
			WHEN ${THUMBNAIL} THEN ${periods.thumbnailDays ?? null}::int
			WHEN ${VIEWING_COPY} THEN ${periods.viewingCopyDays ?? null}::int
		END
	`
}

// CAP-026-R18, CAP-026-R19, CAP-026-R20, datovy-model.md 4 „Binární objekt“, datovy-model.md 5
@Injectable()
export class RetentionRepository {
	private readonly queue: QueueTaskStore

	constructor(private readonly database: DatabaseService) {
		this.queue = new QueueTaskStore(database)
	}

	// CAP-026-R18, CAP-026-S15, CAP-026-S16
	async bufferCopies(): Promise<BufferCopyRow[]> {
		const sql = this.database.sql
		return await sql<BufferCopyRow[]>`
			WITH ${anchoredFiles(sql)}
			SELECT object.id AS binary_object_id, retained.rendition, retained.file_kind, retained.file_id,
				NULL::uuid AS artifact_id, retained.acquisition_id, anchored.retention_anchor
			FROM retained
			JOIN binary_object object ON object.id = retained.binary_object_id
			JOIN anchored ON anchored.source_kind = retained.source_kind AND anchored.source_id = retained.source_id
			WHERE object.buffer_deleted_at IS NULL AND object.clinical_record_uploaded_at IS NOT NULL
			UNION ALL
			SELECT object.id, ${DICOM_FILE}::text, NULL, NULL, artifact.id, artifact.acquisition_id,
				(SELECT max(instance.retention_anchor) FROM delivery_instance instance WHERE instance.artifact_id = artifact.id)
			FROM artifact_variant variant
			JOIN binary_object object ON object.id = variant.binary_object_id
			JOIN artifact ON artifact.id = variant.artifact_id
			WHERE object.buffer_deleted_at IS NULL
				AND EXISTS (SELECT 1 FROM delivery_instance instance WHERE instance.artifact_id = artifact.id)
				AND NOT EXISTS (
					SELECT 1 FROM delivery_instance instance
					WHERE instance.artifact_id = artifact.id AND instance.retention_anchor IS NULL
				)
			LIMIT ${RETENTION_BATCH_SIZE}
		`
	}

	async markBufferDeleted(tx: postgres.TransactionSql, binaryObjectId: string): Promise<boolean> {
		const rows = await tx`
			UPDATE binary_object SET buffer_deleted_at = now()
			WHERE id = ${binaryObjectId} AND buffer_deleted_at IS NULL
			RETURNING id
		`
		return rows.length > 0
	}

	// CAP-026-R01, CAP-026-R02, CAP-026-R20, CAP-026-S17, CAP-026-S18
	async dueFiles(periods: RetentionPeriods): Promise<RetainedFileRow[]> {
		const sql = this.database.sql
		return await sql<RetainedFileRow[]>`
			WITH ${anchoredFiles(sql)}
			SELECT object.id AS binary_object_id, object.clinical_record_binary_id, retained.rendition, retained.file_kind,
				retained.file_id, retained.acquisition_id, anchored.retention_anchor
			FROM retained
			JOIN binary_object object ON object.id = retained.binary_object_id
			JOIN anchored ON anchored.source_kind = retained.source_kind AND anchored.source_id = retained.source_id
			WHERE object.retention_due_at IS NULL
				AND object.buffer_deleted_at IS NOT NULL
				AND object.clinical_record_uploaded_at IS NOT NULL
				AND object.clinical_record_binary_id IS NOT NULL
				AND anchored.retention_anchor + make_interval(days => ${retentionDaysOf(sql, periods)}) <= now()
			LIMIT ${RETENTION_BATCH_SIZE}
		`
	}

	// CAP-026-R19, ADR-050 bod 14
	async markDue(tx: postgres.TransactionSql, binaryObjectId: string): Promise<boolean> {
		const rows = await tx`
			UPDATE binary_object SET retention_due_at = now()
			WHERE id = ${binaryObjectId} AND retention_due_at IS NULL AND buffer_deleted_at IS NOT NULL
				AND clinical_record_uploaded_at IS NOT NULL
			RETURNING id
		`
		return rows.length > 0
	}

	// CAP-026-R19, CAP-021-R37, ADR-050 bod 14, queue_task_open_uniq
	async requestResourceWrite(tx: postgres.TransactionSql, file: RetainedFileRow): Promise<void> {
		await this.queue.enqueue(tx, {
			kind: JOB_KIND.CLINICAL_RECORD_WRITE,
			objectKind: file.file_kind,
			objectId: file.file_id,
		})
	}

	// CAP-026-R19, ADR-050 bod 14
	async detachedFiles(): Promise<RetainedFileRow[]> {
		const sql = this.database.sql
		return await sql<RetainedFileRow[]>`
			WITH ${anchoredFiles(sql)}
			SELECT object.id AS binary_object_id, object.clinical_record_binary_id, retained.rendition, retained.file_kind,
				retained.file_id, retained.acquisition_id, anchored.retention_anchor
			FROM retained
			JOIN binary_object object ON object.id = retained.binary_object_id
			JOIN anchored ON anchored.source_kind = retained.source_kind AND anchored.source_id = retained.source_id
			WHERE object.clinical_record_detached_at IS NOT NULL
			LIMIT ${RETENTION_BATCH_SIZE}
		`
	}

	async lockDetached(tx: postgres.TransactionSql, binaryObjectId: string): Promise<boolean> {
		const rows = await tx`
			SELECT id FROM binary_object
			WHERE id = ${binaryObjectId} AND clinical_record_detached_at IS NOT NULL
			FOR UPDATE
		`
		return rows.length > 0
	}

	// CAP-026-R06, CAP-026-R19, CAP-026-R20, datovy-model.md 4 „Binární objekt“
	async forget(tx: postgres.TransactionSql, file: RetainedFileRow): Promise<void> {
		await this.unlink(tx, file)
		await tx`DELETE FROM binary_object WHERE id = ${file.binary_object_id}`
	}

	private async unlink(tx: postgres.TransactionSql, file: RetainedFileRow): Promise<void> {
		const objectId = file.binary_object_id
		switch (file.rendition) {
			case ORIGINAL:
				await this.unlinkOriginal(tx, file)
				return
			case THUMBNAIL:
				if (file.file_kind === JOB_OBJECT_KIND.IMAGE) {
					await tx`DELETE FROM thumbnail WHERE image_id = ${file.file_id} AND binary_object_id = ${objectId}`
					return
				}
				await tx`
					UPDATE document_page SET thumbnail_binary_object_id = NULL
					WHERE id = ${file.file_id} AND thumbnail_binary_object_id = ${objectId}
				`
				return
			case VIEWING_COPY:
				if (file.file_kind === JOB_OBJECT_KIND.IMAGE) {
					await tx`
						UPDATE image SET viewing_copy_binary_object_id = NULL
						WHERE id = ${file.file_id} AND viewing_copy_binary_object_id = ${objectId}
					`
					return
				}
				await tx`
					UPDATE document_page SET viewing_copy_binary_object_id = NULL
					WHERE id = ${file.file_id} AND viewing_copy_binary_object_id = ${objectId}
				`
				return
			case OUTPUT_PDF:
				await tx`
					UPDATE document SET output_pdf_binary_object_id = NULL, output_pdf_deleted_at = now()
					WHERE id = ${file.file_id} AND output_pdf_binary_object_id = ${objectId}
				`
				return
			case DICOM_FILE:
				throw new Error(`a DICOM file ${objectId} never reaches the clinical record`)
			default:
				file.rendition satisfies never
		}
	}

	private async unlinkOriginal(tx: postgres.TransactionSql, file: RetainedFileRow): Promise<void> {
		const objectId = file.binary_object_id
		if (file.file_kind === JOB_OBJECT_KIND.IMAGE) {
			await tx`
				UPDATE image SET binary_object_id = NULL, original_deleted_at = now()
				WHERE id = ${file.file_id} AND binary_object_id = ${objectId}
			`
			return
		}
		await tx`
			UPDATE document_page SET binary_object_id = NULL, original_deleted_at = now()
			WHERE id = ${file.file_id} AND binary_object_id = ${objectId}
		`
	}
}
