import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE } from "@ansora/contracts"
import { DEVICE_STATE, JOB_KIND, JOB_STATE } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { OperationalMetricsRow } from "../types/monitoring.types"

const OPEN_TASK_STATES = [JOB_STATE.WAITING, JOB_STATE.RUNNING]

// administration.yaml getOperationalMetricsForAdministration, CAP-028-R12, CAP-028-R13, CAP-028-R22
@Injectable()
export class OperationalMetricsRepository {
	constructor(private readonly database: DatabaseService) {}

	async current(): Promise<OperationalMetricsRow> {
		const sql = this.database.sql
		const [row] = await sql<OperationalMetricsRow[]>`
			SELECT
				(SELECT count(*)::int FROM queue_task
					WHERE kind = ${JOB_KIND.CLINICAL_RECORD_WRITE} AND state IN ${sql(OPEN_TASK_STATES)}) AS write_waiting,
				(SELECT count(*)::int FROM queue_task
					WHERE kind = ${JOB_KIND.CLINICAL_RECORD_WRITE} AND state = ${JOB_STATE.FAILED}) AS write_failed,
				(SELECT count(*)::int FROM queue_task
					WHERE kind = ${JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD} AND state IN ${sql(OPEN_TASK_STATES)}) AS upload_waiting,
				(SELECT count(*)::int FROM queue_task
					WHERE kind = ${JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD} AND state = ${JOB_STATE.FAILED}) AS upload_failed,
				(SELECT min(created_at) FROM queue_task
					WHERE kind = ${JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD} AND state IN ${sql(OPEN_TASK_STATES)}
				) AS oldest_open_upload_at,
				(SELECT COALESCE(sum(size_bytes), 0)::text FROM binary_object WHERE buffer_deleted_at IS NULL) AS buffer_bytes,
				(SELECT count(*)::int FROM binary_object buffered
					WHERE buffered.buffer_deleted_at IS NULL AND buffered.set_aside_at IS NULL
						AND EXISTS (
							SELECT 1 FROM image JOIN acquisition ON acquisition.id = image.acquisition_id
							WHERE image.binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM image JOIN acquisition ON acquisition.id = image.acquisition_id
							WHERE image.viewing_copy_binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM thumbnail
								JOIN image ON image.id = thumbnail.image_id
								JOIN acquisition ON acquisition.id = image.acquisition_id
							WHERE thumbnail.binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM document_page page
								JOIN document ON document.id = page.document_id
								JOIN acquisition ON acquisition.id = document.acquisition_id
							WHERE page.binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM document_page page
								JOIN document ON document.id = page.document_id
								JOIN acquisition ON acquisition.id = document.acquisition_id
							WHERE page.thumbnail_binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM document_page page
								JOIN document ON document.id = page.document_id
								JOIN acquisition ON acquisition.id = document.acquisition_id
							WHERE page.viewing_copy_binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
							UNION ALL
							SELECT 1 FROM document JOIN acquisition ON acquisition.id = document.acquisition_id
							WHERE document.output_pdf_binary_object_id = buffered.id AND acquisition.closed_at IS NOT NULL
						)
				) AS buffer_files_waiting_for_deletion,
				(SELECT count(*)::int FROM delivery_instance
					WHERE state = ${DELIVERY_INSTANCE_STATE.WAITING}) AS delivery_waiting,
				(SELECT count(*)::int FROM delivery_instance
					WHERE state = ${DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED}) AS delivery_permanently_failed,
				(SELECT count(*)::int FROM delivery_instance
					WHERE state = ${DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW}) AS delivery_held_for_review,
				(SELECT count(*)::int FROM delivery
					WHERE state = ${DELIVERY_STATE.ASSEMBLY_FAILED}) AS delivery_assembly_failed,
				(SELECT count(*)::int FROM device WHERE state = ${DEVICE_STATE.PENDING_APPROVAL}) AS devices_pending_approval,
				(SELECT count(*)::int FROM device WHERE state = ${DEVICE_STATE.REVOKED}) AS devices_revoked
		`
		if (row === undefined) {
			throw new Error("the operational metrics query returned no row")
		}
		return row
	}
}
