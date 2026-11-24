import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import {
	cursorMomentOf,
	decodeMomentCursor,
	type MomentPage,
	momentPageOf,
	olderThan,
} from "../../infra/utils/cursor-moment"
import type { QueueStateRow, QueueStateScope } from "../types/queue-state.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// CAP-019-R30, CAP-019-S22
function visibleDrafts(sql: postgres.Sql, operatorUserId: string | undefined): Fragment {
	if (operatorUserId === undefined) {
		return sql`a.state <> ${ACQUISITION_STATE.DRAFT}`
	}
	return sql`(a.state <> ${ACQUISITION_STATE.DRAFT} OR a.operator_user_id = ${operatorUserId})`
}

function withKeys(sql: postgres.Sql, acquisitionKeys: readonly string[] | undefined): Fragment {
	return acquisitionKeys === undefined ? sql`TRUE` : sql`a.idempotency_key IN ${sql([...acquisitionKeys])}`
}

@Injectable()
export class QueueStateRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-019-R30, CAP-019-R24, CAP-021-R29, CAP-019-S23
	async listFromDevice(
		scope: QueueStateScope,
		cursor: string | undefined,
		limit: number,
	): Promise<MomentPage<QueueStateRow>> {
		const sql = this.database.sql
		const rows = await sql<QueueStateRow[]>`
			WITH from_device AS (
				SELECT acquisition_id FROM image WHERE announced_by_device_id = ${scope.deviceId}
				UNION
				SELECT d.acquisition_id FROM document_page p JOIN document d ON d.id = p.document_id
				WHERE p.announced_by_device_id = ${scope.deviceId}
				UNION
				SELECT id FROM acquisition WHERE closing_device_id = ${scope.deviceId}
			)
			SELECT a.id, a.idempotency_key, a.state, ${cursorMomentOf(sql, sql`a.created_at`)} AS cursor_moment
			FROM acquisition a JOIN from_device f ON f.acquisition_id = a.id
			WHERE ${visibleDrafts(sql, scope.operatorUserId)}
				AND ${withKeys(sql, scope.acquisitionKeys)}
				AND ${olderThan(sql, sql`a.created_at, a.id`, decodeMomentCursor(cursor))}
			ORDER BY a.created_at DESC, a.id DESC
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}
}
