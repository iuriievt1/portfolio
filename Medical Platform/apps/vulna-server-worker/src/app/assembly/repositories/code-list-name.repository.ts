import type { CodeListCode, LocalizedNames } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { CodeListNameRow } from "../types/assembly.types"

// CAP-021-R26, CAP-017-R18, datovy-model.md 2 „Jazyky a vícejazyčné názvy“
@Injectable()
export class CodeListNameRepository {
	constructor(private readonly database: DatabaseService) {}

	async namesOf(codeList: CodeListCode, code: string): Promise<LocalizedNames | undefined> {
		const rows = await this.database.sql<CodeListNameRow[]>`
			SELECT name.language, name.name
			FROM code_list_item item
			JOIN code_list_item_name name ON name.code_list_item_id = item.id
			WHERE item.code_list_code = ${codeList} AND item.code = ${code}
		`
		return rows.length === 0 ? undefined : Object.fromEntries(rows.map((row) => [row.language, row.name]))
	}
}
