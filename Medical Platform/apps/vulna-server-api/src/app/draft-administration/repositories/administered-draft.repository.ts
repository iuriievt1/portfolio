import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type {
	AdministeredDraftPage,
	AdministeredDraftQuery,
	AdministeredDraftRow,
} from "../types/draft-administration.types"

// CAP-004-R14, administration.yaml searchAcquisitionDrafts, ADR-012
@Injectable()
export class AdministeredDraftRepository {
	constructor(private readonly database: DatabaseService) {}

	async page(query: AdministeredDraftQuery): Promise<AdministeredDraftPage> {
		const sql = this.database.sql
		const byOperator =
			query.operatorUserId === undefined ? sql`TRUE` : sql`draft.operator_user_id = ${query.operatorUserId}`
		const byAge =
			query.notUpdatedSince === undefined
				? sql`TRUE`
				: sql`draft.updated_at <= ${query.notUpdatedSince}::text::timestamptz`
		const rows = await sql<AdministeredDraftRow[]>`
			SELECT draft.id, draft.kind, draft.operator_user_id, operator.display_name AS operator_display_name,
				draft.patient_id, draft.encounter_id, draft.started_at,
				${cursorMomentOf(sql, sql`draft.updated_at`)} AS updated_at_moment
			FROM acquisition draft
			JOIN app_user operator ON operator.id = draft.operator_user_id
			WHERE draft.state = ${ACQUISITION_STATE.DRAFT} AND ${byOperator} AND ${byAge}
				AND ${olderThan(sql, sql`draft.updated_at, draft.id`, decodeMomentCursor(query.cursor))}
			ORDER BY draft.updated_at DESC, draft.id DESC
			LIMIT ${query.limit + 1}
		`
		return momentPageOf(rows, query.limit, (row) => row.updated_at_moment)
	}

	// CAP-015-R20
	async isUnchangedSince(tx: postgres.TransactionSql, acquisitionId: string, seenUpdatedAt: string): Promise<boolean> {
		const [row] = await tx<{ is_unchanged: boolean }[]>`
			SELECT updated_at = ${seenUpdatedAt}::text::timestamptz AS is_unchanged FROM acquisition WHERE id = ${acquisitionId}
		`
		return row?.is_unchanged === true
	}
}
