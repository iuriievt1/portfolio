import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { ARTIFACT_SOURCE_KIND } from "../../clinical-record/constants/clinical-record.constants"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type {
	DeliveryInstanceRow,
	DeliveryPage,
	DeliveryPageRow,
	DeliveryQuery,
	DeliveryRow,
	DeliveryTargetRow,
} from "../types/delivery-monitoring.types"

// administration.yaml listDeliveries, getDelivery, listDeliveryTargets, datovy-model.md 4 „Doručení“, „Cíl doručení“
@Injectable()
export class DeliveryOverviewRepository {
	constructor(private readonly database: DatabaseService) {}

	// NAB-345, ADR-012, delivery_listing_idx, delivery_instance_state_idx
	async page(sql: Executor, query: DeliveryQuery): Promise<DeliveryPage> {
		const byState = query.state === undefined ? sql`TRUE` : sql`delivery.state = ${query.state}`
		const byInstanceState =
			query.instanceState === undefined
				? sql`TRUE`
				: sql`EXISTS (
					SELECT 1 FROM delivery_instance instance
					WHERE instance.delivery_id = delivery.id AND instance.state = ${query.instanceState}
				)`
		const rows = await sql<DeliveryPageRow[]>`
			SELECT delivery.id, delivery.acquisition_id, acquisition.kind AS acquisition_kind,
				acquisition.closed_at AS acquisition_closed_at, delivery.target, delivery.state, delivery.reason,
				${cursorMomentOf(sql, sql`delivery.created_at`)} AS cursor_moment
			FROM delivery
			JOIN acquisition ON acquisition.id = delivery.acquisition_id
			WHERE ${byState} AND ${byInstanceState}
				AND ${olderThan(sql, sql`delivery.created_at, delivery.id`, decodeMomentCursor(query.cursor))}
			ORDER BY delivery.created_at DESC, delivery.id DESC
			LIMIT ${query.limit + 1}
		`
		return momentPageOf(rows, query.limit, (row) => row.cursor_moment)
	}

	async find(sql: Executor, deliveryId: string): Promise<DeliveryRow | undefined> {
		const [delivery] = await sql<DeliveryRow[]>`
			SELECT delivery.id, delivery.acquisition_id, acquisition.kind AS acquisition_kind,
				acquisition.closed_at AS acquisition_closed_at, delivery.target, delivery.state, delivery.reason
			FROM delivery
			JOIN acquisition ON acquisition.id = delivery.acquisition_id
			WHERE delivery.id = ${deliveryId}
		`
		return delivery
	}

	// delivery_instance_artifact_uniq, CAP-015-R33
	async instancesOf(sql: Executor, deliveryIds: readonly string[]): Promise<DeliveryInstanceRow[]> {
		if (deliveryIds.length === 0) {
			return []
		}
		return await sql<DeliveryInstanceRow[]>`
			SELECT instance.id, instance.delivery_id, instance.artifact_id, instance.state, instance.attempts,
				instance.last_dimse_status, instance.accepted_transfer_syntax, instance.retention_anchor,
				instance.held_for_review_cause, instance.verification_rejections, instance.verification_on_hold_at,
				instance.closed_from_state, instance.closed_at, instance.closed_by_user_id, instance.closure_reason
			FROM delivery_instance instance
			JOIN artifact ON artifact.id = instance.artifact_id
			LEFT JOIN image ON artifact.source_kind = ${ARTIFACT_SOURCE_KIND.IMAGE} AND image.id = artifact.source_id
			WHERE instance.delivery_id IN ${sql(deliveryIds)}
			ORDER BY image.sequence, instance.id
		`
	}

	// CAP-023-R23, CAP-023-R24
	async targets(): Promise<DeliveryTargetRow[]> {
		return await this.database.sql<DeliveryTargetRow[]>`
			SELECT code, state, reason, changed_at FROM delivery_target ORDER BY code
		`
	}
}
