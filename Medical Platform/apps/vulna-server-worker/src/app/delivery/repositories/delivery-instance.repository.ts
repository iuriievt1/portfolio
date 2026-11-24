import {
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	DELIVERY_TARGET_STATE,
	type DeliveryInstanceState,
} from "@ansora/contracts"
import { CLAIMED_TASK_ALIAS, JOB_KIND, JOB_OBJECT_KIND, type QueueCondition, QueueTaskStore } from "@ansora/core-server"
import {
	ACQUISITION_STATE,
	assembledRecordStateOf,
	type RecordDeliveryStates,
	SETTLED_INSTANCE_STATES,
} from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FILE_STATUS } from "../../../libs/common/constants/file-status.constants"
import { acquisitionSeriesCondition } from "../../../libs/common/utils/acquisition-series"
import { DatabaseService } from "../../../libs/database/database.service"
import type {
	DeliveryInstance,
	DeliveryInstanceRow,
	DeliverySettlementRow,
	InstanceTransition,
	StoredVariantRow,
	UploadedFileRow,
} from "../types/delivery.types"

function deliveryInstanceOf(row: DeliveryInstanceRow): DeliveryInstance {
	return {
		id: row.id,
		deliveryId: row.delivery_id,
		state: row.state,
		attempts: row.attempts,
		verificationRejections: row.verification_rejections,
		artifactId: row.artifact_id,
		sourceKind: row.source_kind,
		sopClassUid: row.sop_class_uid,
		sopInstanceUid: row.sop_instance_uid,
		acquisitionId: row.acquisition_id,
		targetCode: row.target,
		studyInstanceUid: row.study_instance_uid,
		seriesInstanceUid: row.series_instance_uid,
	}
}

const { SENDING, CONFIRMED } = DELIVERY_INSTANCE_STATE

// datovy-model.md 4 „Doručení“, „Úloha fronty“, dorucovaci-jadro.md 5, ADR-016
@Injectable()
export class DeliveryInstanceRepository {
	readonly queue: QueueTaskStore

	constructor(private readonly database: DatabaseService) {
		this.queue = new QueueTaskStore(database)
	}

	// CAP-023-R23, CAP-023-R24, CAP-023-R25, CAP-023-R26, dorucovaci-jadro.md 5.3, 5.4
	claimCondition(): QueueCondition {
		const sql = this.database.sql
		const task = sql(CLAIMED_TASK_ALIAS)
		return sql`EXISTS (
			SELECT 1 FROM delivery_instance instance
			JOIN delivery ON delivery.id = instance.delivery_id
			JOIN delivery_target target ON target.code = delivery.target
			WHERE instance.id = ${task}.object_id
				AND (
					instance.state = ${SENDING}
					OR (target.state = ${DELIVERY_TARGET_STATE.ACTIVE} AND instance.verification_on_hold_at IS NULL)
				)
		)`
	}

	// integrace-dicom.md 9, datovy-model.md 3
	async find(instanceId: string): Promise<DeliveryInstance | undefined> {
		const [row] = await this.database.sql<DeliveryInstanceRow[]>`
			SELECT instance.id, instance.delivery_id, instance.state, instance.attempts, instance.verification_rejections,
				artifact.id AS artifact_id, artifact.source_kind, artifact.sop_class_uid, artifact.sop_instance_uid,
				delivery.acquisition_id, delivery.target,
				encounter.study_instance_uid, series.series_instance_uid
			FROM delivery_instance instance
			JOIN delivery ON delivery.id = instance.delivery_id
			JOIN artifact ON artifact.id = instance.artifact_id
			JOIN acquisition a ON a.id = delivery.acquisition_id
			JOIN encounter ON encounter.id = a.encounter_id
			LEFT JOIN document ON document.acquisition_id = a.id
			JOIN series ON ${acquisitionSeriesCondition(this.database.sql)}
			WHERE instance.id = ${instanceId}
		`
		return row === undefined ? undefined : deliveryInstanceOf(row)
	}

	// CAP-023-R15, datovy-model.md 4 „Artefakt“
	async variantsOf(artifactId: string): Promise<StoredVariantRow[]> {
		return await this.database.sql<StoredVariantRow[]>`
			SELECT transfer_syntax, dataset_sha256, binary_object_id
			FROM artifact_variant
			WHERE artifact_id = ${artifactId}
			ORDER BY transfer_syntax
		`
	}

	// datovy-model.md 4 „Doručení“, CAP-023-R10, CAP-023-R14, CAP-023-R26, CAP-026-R03, CAP-026-R05
	async transition(tx: postgres.TransactionSql, instanceId: string, change: InstanceTransition): Promise<boolean> {
		const isAnchored = change.to === CONFIRMED
		const changed = await tx<{ id: string }[]>`
			UPDATE delivery_instance SET
				state = ${change.to},
				attempts = attempts + ${change.countedAttempts},
				last_dimse_status = COALESCE(${change.statusHex ?? null}, last_dimse_status),
				accepted_transfer_syntax = COALESCE(${change.acceptedTransferSyntax ?? null}, accepted_transfer_syntax),
				held_for_review_cause = ${change.heldForReviewCause ?? null},
				retention_anchor = CASE WHEN ${isAnchored} THEN now() ELSE NULL END,
				verification_rejections = ${change.verificationRejections},
				verification_on_hold_at = CASE WHEN ${change.isOnHold} THEN now() ELSE NULL END
			WHERE id = ${instanceId} AND state = ${change.from}
			RETURNING id
		`
		return changed.length > 0
	}

	// CAP-023-R25
	async markSending(tx: postgres.TransactionSql, instanceId: string, from: DeliveryInstanceState): Promise<boolean> {
		const changed = await tx<{ id: string }[]>`
			UPDATE delivery_instance SET state = ${SENDING}
			WHERE id = ${instanceId} AND state = ${from}
			RETURNING id
		`
		return changed.length > 0
	}

	// PostgreSQL 13.2.1, 13.3.2
	async lockRecord(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await tx`SELECT id FROM acquisition WHERE id = ${acquisitionId} FOR NO KEY UPDATE`
	}

	// CAP-021-R28, backend.md 3 T4, T4b
	async requestClinicalRecordWrites(tx: postgres.TransactionSql, acquisitionId: string): Promise<boolean> {
		const [settlement] = await tx<DeliverySettlementRow[]>`
			SELECT
				bool_and(instance.state IN ${tx(SETTLED_INSTANCE_STATES)}) AS is_settled,
				bool_or(instance.state = ${CONFIRMED}) AS has_confirmed,
				NOT EXISTS (
					SELECT 1 FROM delivery
					WHERE delivery.acquisition_id = ${acquisitionId} AND delivery.state = ${DELIVERY_STATE.WAITING_FOR_ASSEMBLY}
				) AS is_assembly_over
			FROM delivery
			JOIN delivery_instance instance ON instance.delivery_id = delivery.id
			WHERE delivery.acquisition_id = ${acquisitionId}
		`
		if (settlement?.is_settled !== true || settlement.has_confirmed !== true || settlement.is_assembly_over !== true) {
			return false
		}
		await this.queue.enqueue(tx, {
			kind: JOB_KIND.CLINICAL_RECORD_WRITE,
			objectKind: JOB_OBJECT_KIND.ACQUISITION,
			objectId: acquisitionId,
		})
		for (const file of await this.uploadedFilesOf(tx, acquisitionId)) {
			await this.queue.enqueue(tx, { kind: JOB_KIND.CLINICAL_RECORD_WRITE, objectKind: file.kind, objectId: file.id })
		}
		return true
	}

	// CAP-021-R37, CAP-021-R39
	private async uploadedFilesOf(tx: postgres.TransactionSql, acquisitionId: string): Promise<UploadedFileRow[]> {
		const images = await tx<UploadedFileRow[]>`
			SELECT ${JOB_OBJECT_KIND.IMAGE} AS kind, image.id, object.clinical_record_uploaded_at IS NOT NULL AS is_uploaded
			FROM image JOIN binary_object object ON object.id = image.binary_object_id
			WHERE image.acquisition_id = ${acquisitionId} AND image.status = ${FILE_STATUS.RECEIVED}
			FOR SHARE OF object
		`
		const pages = await tx<UploadedFileRow[]>`
			SELECT ${JOB_OBJECT_KIND.DOCUMENT_PAGE} AS kind, page.id, object.clinical_record_uploaded_at IS NOT NULL AS is_uploaded
			FROM document_page page
			JOIN document ON document.id = page.document_id
			JOIN binary_object object ON object.id = page.binary_object_id
			WHERE document.acquisition_id = ${acquisitionId} AND page.status = ${FILE_STATUS.RECEIVED}
			FOR SHARE OF object
		`
		const documents = await tx<UploadedFileRow[]>`
			SELECT ${JOB_OBJECT_KIND.DOCUMENT} AS kind, document.id, object.clinical_record_uploaded_at IS NOT NULL AS is_uploaded
			FROM document JOIN binary_object object ON object.id = document.output_pdf_binary_object_id
			WHERE document.acquisition_id = ${acquisitionId}
			FOR SHARE OF object
		`
		return [...images, ...pages, ...documents].filter((file) => file.is_uploaded)
	}

	// datovy-model.md 4 „Pořízení“
	async refreshAcquisitionState(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		const [states] = await tx<RecordDeliveryStates[]>`
			SELECT
				ARRAY(SELECT state FROM delivery WHERE acquisition_id = ${acquisitionId}) AS parents,
				ARRAY(
					SELECT instance.state FROM delivery_instance instance JOIN delivery ON delivery.id = instance.delivery_id
					WHERE delivery.acquisition_id = ${acquisitionId}
				) AS instances
		`
		if (states === undefined) {
			throw new Error("the record delivery states query returned no row")
		}
		await tx`
			UPDATE acquisition SET state = ${assembledRecordStateOf(states)}
			WHERE id = ${acquisitionId} AND state <> ${ACQUISITION_STATE.DRAFT}
		`
	}
}
