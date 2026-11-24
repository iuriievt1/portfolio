import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { NewWoundTypeChange, WoundTypeChangeRow } from "../types/finding-history.types"

const COLUMNS = [
	"id",
	"finding_id",
	"changed_at",
	"changed_by",
	"previous_wound_type_code",
	"previous_wound_type_code_list_version",
	"wound_type_code",
	"wound_type_code_list_version",
] as const

// datovy-model.md 2, CAP-020-R19, CAP-020-R21
@Injectable()
export class WoundTypeChangeRepository {
	// CAP-020-R19, CAP-020-S25
	async listOf(sql: Executor, findingId: string): Promise<WoundTypeChangeRow[]> {
		return await sql<WoundTypeChangeRow[]>`
			SELECT ${sql(COLUMNS)} FROM finding_wound_type_change
			WHERE finding_id = ${findingId}
			ORDER BY changed_at DESC, id DESC
		`
	}

	// CAP-020-R21, CAP-025-R30
	async insert(tx: postgres.TransactionSql, change: NewWoundTypeChange): Promise<void> {
		await tx`
			INSERT INTO finding_wound_type_change (
				id, finding_id, changed_at, changed_by, previous_wound_type_code, previous_wound_type_code_list_version,
				wound_type_code, wound_type_code_list_version
			) VALUES (
				${change.id}, ${change.findingId}, ${change.changedAt}, ${change.changedBy}, ${change.previousCode},
				${change.previousCodeListVersion}, ${change.code}, ${change.codeListVersion}
			)
		`
	}
}
