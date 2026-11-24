import { OPERATOR_NOTIFICATION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// CAP-015-R18, CAP-026-R16, datovy-model.md 4
@Injectable()
export class DraftReminderRepository {
	// operator_notification_reminder_uniq
	async remindStaleDrafts(tx: postgres.TransactionSql, reminderSeconds: number): Promise<number> {
		const rows = await tx`
			INSERT INTO operator_notification (id, user_id, kind, acquisition_id, acquisition_updated_at)
			SELECT gen_random_uuid(), draft.operator_user_id, ${OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER}, draft.id,
				draft.updated_at
			FROM acquisition draft
			WHERE draft.state = ${ACQUISITION_STATE.DRAFT}
				AND draft.updated_at <= now() - make_interval(secs => ${reminderSeconds})
			ON CONFLICT (acquisition_id, acquisition_updated_at) WHERE kind = 'draft_reminder' DO NOTHING
			RETURNING id
		`
		return rows.length
	}

	// CAP-004-R14
	async countStaleDrafts(tx: postgres.TransactionSql, reminderSeconds: number): Promise<number> {
		const [row] = await tx<{ count: number }[]>`
			SELECT count(*)::int AS count FROM acquisition
			WHERE state = ${ACQUISITION_STATE.DRAFT} AND updated_at <= now() - make_interval(secs => ${reminderSeconds})
		`
		return row?.count ?? 0
	}
}
