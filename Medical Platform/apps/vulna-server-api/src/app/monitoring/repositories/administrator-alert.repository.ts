import { randomUUID } from "node:crypto"
import { ADMINISTRATOR_ALERT_KIND, type AdministratorAlertKind, BINARY_RENDITION } from "@ansora/contracts"
import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type {
	ActiveAlertCountRow,
	AdministratorAlertPage,
	AdministratorAlertQuery,
	AdministratorAlertRow,
	LockedAlert,
} from "../types/monitoring.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// CAP-021-R36, CAP-021-R39, backend.md 3.2 U1–U7
function pendingRenditionOf(sql: postgres.Sql): Fragment {
	return sql`CASE
		WHEN original_object.id IS NOT NULL AND original_object.clinical_record_uploaded_at IS NULL
			THEN ${BINARY_RENDITION.ORIGINAL}
		WHEN thumbnail_object.id IS NOT NULL AND thumbnail_object.clinical_record_uploaded_at IS NULL
			THEN ${BINARY_RENDITION.THUMBNAIL}
		WHEN copy_object.id IS NOT NULL AND copy_object.clinical_record_uploaded_at IS NULL
			THEN ${BINARY_RENDITION.VIEWING_COPY}
		WHEN pdf_object.id IS NOT NULL AND pdf_object.clinical_record_uploaded_at IS NULL
			THEN ${BINARY_RENDITION.OUTPUT_PDF}
	END`
}

// datovy-model.md 4, CAP-028-R15
@Injectable()
export class AdministratorAlertRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-021-R27, administrator_alert_active_task_uniq
	async raiseForFailedWrite(tx: postgres.TransactionSql, taskId: string, message: string): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, queue_task_id)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED}, ${message}, ${taskId})
			ON CONFLICT (queue_task_id) WHERE resolved_at IS NULL DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-021-R27
	async resolveForTask(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE queue_task_id = ${taskId} AND resolved_at IS NULL
		`
	}

	// CAP-021-R31, administrator_alert_active_task_uniq
	async handOver(tx: postgres.TransactionSql, fromTaskId: string, toTaskId: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET queue_task_id = ${toTaskId}
			WHERE queue_task_id = ${fromTaskId} AND resolved_at IS NULL
				AND NOT EXISTS (
					SELECT 1 FROM administrator_alert WHERE queue_task_id = ${toTaskId} AND resolved_at IS NULL
				)
		`
		await this.resolveForTask(tx, fromTaskId)
	}

	// CAP-025-R21, administrator_alert_active_audit_uniq
	async raiseForBrokenAuditChain(
		tx: postgres.TransactionSql,
		auditId: string,
		message: string,
	): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, audit_id)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN}, ${message}, ${auditId})
			ON CONFLICT (audit_id) WHERE resolved_at IS NULL DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-025-R21
	async resolveBrokenAuditChain(): Promise<void> {
		await this.database.sql`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN} AND resolved_at IS NULL
		`
	}

	// CAP-028-R22, administrator_alert_active_store_unavailable_uniq
	async raiseStoreUnavailable(tx: postgres.TransactionSql, message: string): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_STORE_UNAVAILABLE}, ${message})
			ON CONFLICT (kind) WHERE resolved_at IS NULL AND kind = 'clinical_record_store_unavailable' DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-028-R22
	async resolveStoreUnavailable(): Promise<void> {
		await this.database.sql`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_STORE_UNAVAILABLE} AND resolved_at IS NULL
		`
	}

	// CAP-023-R23, CAP-023-R24, CAP-023-R27
	async resolveForTarget(tx: postgres.TransactionSql, kind: AdministratorAlertKind, targetCode: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${kind} AND target_code = ${targetCode} AND resolved_at IS NULL
		`
	}

	// CAP-023-R26, CAP-023-R28
	// CAP-026-R14, datovy-model.md 4 „Upozornění správce“
	async resolveAllOf(tx: postgres.TransactionSql, kind: AdministratorAlertKind): Promise<void> {
		await tx`UPDATE administrator_alert SET resolved_at = now() WHERE kind = ${kind} AND resolved_at IS NULL`
	}

	async resolveForInstance(
		tx: postgres.TransactionSql,
		kind: AdministratorAlertKind,
		deliveryInstanceId: string,
	): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${kind} AND delivery_instance_id = ${deliveryInstanceId} AND resolved_at IS NULL
		`
	}

	// CAP-022-R15, datovy-model.md 4 „Doručení“
	async resolveForDelivery(
		tx: postgres.TransactionSql,
		kind: AdministratorAlertKind,
		deliveryId: string,
	): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${kind} AND delivery_id = ${deliveryId} AND resolved_at IS NULL
		`
	}

	// administration.yaml acknowledgeAdministratorAlert
	async locked(tx: postgres.TransactionSql, alertId: string): Promise<LockedAlert | undefined> {
		const [alert] = await tx<LockedAlert[]>`
			SELECT kind, resolved_at, delivery_id, delivery_instance_id FROM administrator_alert
			WHERE id = ${alertId}
			FOR UPDATE
		`
		return alert
	}

	// CAP-023-R12, CHG-189, administrator_alert_acknowledgement_check
	async acknowledge(tx: postgres.TransactionSql, alertId: string, administratorUserId: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now(), acknowledged_at = now(),
				acknowledged_by_user_id = ${administratorUserId}
			WHERE id = ${alertId}
		`
	}

	// CAP-028-R15
	async activeCounts(): Promise<ActiveAlertCountRow[]> {
		return await this.database.sql<ActiveAlertCountRow[]>`
			SELECT kind, count(*)::int AS count FROM administrator_alert WHERE resolved_at IS NULL GROUP BY kind
		`
	}

	// administration.yaml listAdministratorAlerts, ADR-012
	async page(query: AdministratorAlertQuery): Promise<AdministratorAlertPage> {
		const sql = this.database.sql
		const byKind = query.kind === undefined ? sql`TRUE` : sql`alert.kind = ${query.kind}`
		const byActivity = query.isActive === undefined ? sql`TRUE` : sql`(alert.resolved_at IS NULL) = ${query.isActive}`
		const rows = await sql<AdministratorAlertRow[]>`
			SELECT alert.id, alert.kind, alert.raised_at, alert.resolved_at, alert.message, alert.audit_id, alert.delivery_id,
				alert.delivery_instance_id, alert.target_code, alert.set_aside_object_count, alert.acknowledged_at,
				alert.acknowledged_by_user_id,
				${cursorMomentOf(sql, sql`alert.raised_at`)} AS cursor_moment,
				task.id AS task_id, task.object_kind, task.object_id,
				image.acquisition_id AS image_acquisition_id, page.document_id AS page_document_id,
				pdf_document.id AS pdf_document_id, ${pendingRenditionOf(sql)} AS pending_rendition
			FROM administrator_alert alert
			LEFT JOIN queue_task task ON task.id = alert.queue_task_id
			LEFT JOIN image ON task.object_kind = ${JOB_OBJECT_KIND.IMAGE} AND image.id = task.object_id
			LEFT JOIN document_page page ON task.object_kind = ${JOB_OBJECT_KIND.DOCUMENT_PAGE} AND page.id = task.object_id
			LEFT JOIN thumbnail image_thumbnail ON image_thumbnail.image_id = image.id
			LEFT JOIN binary_object original_object
				ON original_object.id = COALESCE(image.binary_object_id, page.binary_object_id)
			LEFT JOIN binary_object thumbnail_object
				ON thumbnail_object.id = COALESCE(image_thumbnail.binary_object_id, page.thumbnail_binary_object_id)
			LEFT JOIN binary_object copy_object
				ON copy_object.id = COALESCE(image.viewing_copy_binary_object_id, page.viewing_copy_binary_object_id)
			LEFT JOIN document pdf_document
				ON task.object_kind = ${JOB_OBJECT_KIND.DOCUMENT} AND pdf_document.id = task.object_id
			LEFT JOIN binary_object pdf_object ON pdf_object.id = pdf_document.output_pdf_binary_object_id
			WHERE ${byKind} AND ${byActivity}
				AND ${olderThan(sql, sql`alert.raised_at, alert.id`, decodeMomentCursor(query.cursor))}
			ORDER BY alert.raised_at DESC, alert.id DESC
			LIMIT ${query.limit + 1}
		`
		return momentPageOf(rows, query.limit, (row) => row.cursor_moment)
	}
}
