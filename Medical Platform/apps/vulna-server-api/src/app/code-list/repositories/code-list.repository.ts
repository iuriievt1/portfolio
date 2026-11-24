import { randomUUID } from "node:crypto"
import type { CodeListItemState } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type {
	CodeListItemRow,
	CodeListRow,
	ItemNameKey,
	ItemNameWrite,
	StoredCodeListItem,
} from "../types/code-list.types"

const ITEM_COLUMNS = ["id", "code_list_code", "code", "sequence", "is_active"] as const

function storedItem(row: CodeListItemRow): StoredCodeListItem {
	return {
		id: row.id,
		codeListCode: row.code_list_code,
		code: row.code,
		sequence: row.sequence,
		isActive: row.is_active,
		names: row.names,
	}
}

function removedNamesOf(item: CodeListItemState, before: StoredCodeListItem | undefined): ItemNameKey[] {
	if (before === undefined) {
		return []
	}
	return Object.keys(before.names)
		.filter((language) => !Object.hasOwn(item.names, language))
		.map((language) => ({ itemId: before.id, language }))
}

function nameWritesOf(itemId: string, item: CodeListItemState): ItemNameWrite[] {
	return Object.entries(item.names).map(([language, name]) => ({ itemId, language, name }))
}

// CAP-017-R05, CAP-017-R08, CAP-017-R18, datovy-model.md 2
@Injectable()
export class CodeListRepository {
	async lists(sql: Executor): Promise<CodeListRow[]> {
		return await sql<CodeListRow[]>`
			SELECT code_list.code, code_list.name, count(code_list_item.id)::int AS item_count
			FROM code_list
			LEFT JOIN code_list_item ON code_list_item.code_list_code = code_list.code
			GROUP BY code_list.code
			ORDER BY code_list.sequence, code_list.code
		`
	}

	async hasList(sql: Executor, code: string): Promise<boolean> {
		const [row] = await sql<{ code: string }[]>`SELECT code FROM code_list WHERE code = ${code}`
		return row !== undefined
	}

	async items(sql: Executor, codeListCode: string | undefined): Promise<StoredCodeListItem[]> {
		const listCode = codeListCode ?? null
		const rows = await sql<CodeListItemRow[]>`
			SELECT code_list_item.id, code_list_item.code_list_code, code_list_item.code, code_list_item.sequence,
				code_list_item.is_active,
				COALESCE(
					jsonb_object_agg(code_list_item_name.language, code_list_item_name.name)
						FILTER (WHERE code_list_item_name.language IS NOT NULL),
					'{}'::jsonb
				) AS names
			FROM code_list_item
			LEFT JOIN code_list_item_name ON code_list_item_name.code_list_item_id = code_list_item.id
			WHERE ${listCode}::text IS NULL OR code_list_item.code_list_code = ${listCode}
			GROUP BY code_list_item.id
			ORDER BY code_list_item.code_list_code, code_list_item.sequence, code_list_item.code
		`
		return rows.map(storedItem)
	}

	// CAP-017-R08, CAP-017-R16
	async isOffered(sql: Executor, codeListCode: string, code: string): Promise<boolean> {
		const [row] = await sql`
			SELECT 1 FROM code_list_item
			WHERE code_list_code = ${codeListCode} AND code = ${code} AND is_active
		`
		return row !== undefined
	}

	// CAP-017-R08
	async writeItems(
		tx: postgres.TransactionSql,
		codeListCode: string,
		changed: readonly CodeListItemState[],
		existing: readonly StoredCodeListItem[],
	): Promise<void> {
		if (changed.length === 0) {
			return
		}
		const existingByCode = new Map(existing.map((item) => [item.code, item]))
		const written = changed.map((item) => ({ item, id: existingByCode.get(item.code)?.id ?? randomUUID() }))
		const rows = written.map(({ item, id }) => ({
			id,
			code_list_code: codeListCode,
			code: item.code,
			sequence: item.sequence,
			is_active: item.isActive,
		}))
		await tx`
			INSERT INTO code_list_item ${tx(rows, ...ITEM_COLUMNS)}
			ON CONFLICT (id) DO UPDATE SET
				sequence = EXCLUDED.sequence,
				is_active = EXCLUDED.is_active,
				updated_at = now()
		`
		await this.deleteNames(
			tx,
			changed.flatMap((item) => removedNamesOf(item, existingByCode.get(item.code))),
		)
		await this.writeNames(
			tx,
			written.flatMap(({ item, id }) => nameWritesOf(id, item)),
		)
	}

	// CAP-017-R18
	async writeNames(tx: postgres.TransactionSql, writes: readonly ItemNameWrite[]): Promise<void> {
		if (writes.length === 0) {
			return
		}
		// no parameter limit
		await tx`
			INSERT INTO code_list_item_name (code_list_item_id, language, name)
			SELECT * FROM unnest(
				${writes.map((write) => write.itemId)}::uuid[],
				${writes.map((write) => write.language)}::text[],
				${writes.map((write) => write.name)}::text[]
			)
			ON CONFLICT (code_list_item_id, language) DO UPDATE SET
				name = EXCLUDED.name,
				updated_at = CASE
					WHEN code_list_item_name.name = EXCLUDED.name THEN code_list_item_name.updated_at
					ELSE now()
				END
		`
	}

	private async deleteNames(tx: postgres.TransactionSql, removed: readonly ItemNameKey[]): Promise<void> {
		if (removed.length === 0) {
			return
		}
		await tx`
			DELETE FROM code_list_item_name
			WHERE (code_list_item_id, language) IN (
				SELECT * FROM unnest(
					${removed.map((name) => name.itemId)}::uuid[],
					${removed.map((name) => name.language)}::text[]
				)
			)
		`
	}
}
