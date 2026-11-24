import { randomUUID } from "node:crypto"
import { CODE_LIST_SET_LOCK_KEY } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { CodeListSetRow } from "../types/code-list.types"

const COLUMNS = ["id", "version", "body_diagram_version"] as const
const NO_CODE_LIST_SET = "The instance has no code list set; the installation step writes the first one"

// CAP-017-R09, CAP-017-R20
@Injectable()
export class CodeListSetRepository {
	async latest(sql: Executor): Promise<CodeListSetRow | undefined> {
		const [row] = await sql<CodeListSetRow[]>`
			SELECT ${sql(COLUMNS)} FROM code_list_set ORDER BY version DESC LIMIT 1
		`
		return row
	}

	async current(sql: Executor): Promise<CodeListSetRow> {
		const set = await this.latest(sql)
		if (set === undefined) {
			throw new Error(NO_CODE_LIST_SET)
		}
		return set
	}

	async byVersion(sql: Executor, version: number): Promise<CodeListSetRow | undefined> {
		const [row] = await sql<CodeListSetRow[]>`SELECT ${sql(COLUMNS)} FROM code_list_set WHERE version = ${version}`
		return row
	}

	async byId(sql: Executor, id: string): Promise<CodeListSetRow | undefined> {
		const [row] = await sql<CodeListSetRow[]>`SELECT ${sql(COLUMNS)} FROM code_list_set WHERE id = ${id}`
		return row
	}

	// CAP-017-R05, CAP-017-R20, CAP-012-R28, pg_advisory_xact_lock
	async lock(tx: postgres.TransactionSql): Promise<void> {
		await tx`SELECT pg_advisory_xact_lock(${CODE_LIST_SET_LOCK_KEY})`
	}

	// CAP-016-R07, CAP-016-R18
	async publish(tx: postgres.TransactionSql, authorUserId: string): Promise<CodeListSetRow> {
		const [row] = await tx<CodeListSetRow[]>`
			INSERT INTO code_list_set (id, version, body_diagram_version, body_diagram_digest, author_user_id)
			SELECT ${randomUUID()}::uuid, version + 1, body_diagram_version, body_diagram_digest, ${authorUserId}::uuid
			FROM code_list_set
			ORDER BY version DESC
			LIMIT 1
			RETURNING ${tx(COLUMNS)}
		`
		if (row === undefined) {
			throw new Error(NO_CODE_LIST_SET)
		}
		return row
	}
}
