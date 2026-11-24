import { randomUUID } from "node:crypto"
import { OPERATOR_NOTIFICATION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { DiscardedDraftsNotification, OperatorNotificationRow } from "../types/operator-notification.types"

// datovy-model.md 4, CAP-015-R20, CAP-026-R16
@Injectable()
export class OperatorNotificationRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-003-R01, CAP-015-R18
	async listUnacknowledged(userId: string): Promise<OperatorNotificationRow[]> {
		const sql = this.database.sql
		return await sql<OperatorNotificationRow[]>`
			SELECT notification.id, notification.kind, notification.created_at, notification.acquisition_id,
				notification.discarded_count, notification.discarded_at
			FROM operator_notification notification
			LEFT JOIN acquisition draft ON draft.id = notification.acquisition_id
			WHERE notification.user_id = ${userId} AND notification.acknowledged_at IS NULL
				AND (
					notification.kind <> ${OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER}
					OR (draft.state = ${ACQUISITION_STATE.DRAFT} AND draft.updated_at = notification.acquisition_updated_at)
				)
			ORDER BY notification.created_at, notification.id
		`
	}

	// CAP-015-R20
	async acknowledge(userId: string, notificationId: string): Promise<boolean> {
		const rows = await this.database.sql`
			UPDATE operator_notification SET acknowledged_at = coalesce(acknowledged_at, now())
			WHERE id = ${notificationId} AND user_id = ${userId}
			RETURNING id
		`
		return rows.length > 0
	}

	// CAP-015-R20, CAP-015-S23
	async insertDiscarded(tx: postgres.TransactionSql, notification: DiscardedDraftsNotification): Promise<void> {
		await tx`
			INSERT INTO operator_notification (id, user_id, kind, draft_discard_consent_id, discarded_count, discarded_at)
			VALUES (
				${randomUUID()}, ${notification.userId}, ${OPERATOR_NOTIFICATION_KIND.DRAFT_DISCARDED_BY_ADMINISTRATOR},
				${notification.consentId}, ${notification.discardedCount}, ${notification.discardedAt}
			)
		`
	}
}
