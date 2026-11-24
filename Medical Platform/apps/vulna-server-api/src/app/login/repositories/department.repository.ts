import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { DepartmentCodeRow, DepartmentIdRow, UserDepartmentRow } from "../types/department.types"

@Injectable()
export class DepartmentRepository {
	constructor(private readonly database: DatabaseService) {}

	async codesOfUsers(userIds: readonly string[]): Promise<Map<string, string>> {
		if (userIds.length === 0) {
			return new Map()
		}
		const sql = this.database.sql
		const rows = await sql<UserDepartmentRow[]>`
			SELECT app_user.id AS user_id, department.code FROM app_user
			JOIN department ON department.id = app_user.department_id
			WHERE app_user.id IN ${sql(userIds)}
		`
		return new Map(rows.map((row) => [row.user_id, row.code]))
	}

	async lockedCodeOf(sql: Executor, userId: string): Promise<string | null> {
		const [row] = await sql<DepartmentCodeRow[]>`
			SELECT department.code FROM app_user
			LEFT JOIN department ON department.id = app_user.department_id
			WHERE app_user.id = ${userId}
			FOR UPDATE OF app_user
		`
		if (row === undefined) {
			throw new Error(`user ${userId} does not exist`)
		}
		return row.code
	}

	async ensure(sql: Executor, code: string): Promise<string> {
		await sql`INSERT INTO department (id, code) VALUES (${randomUUID()}, ${code}) ON CONFLICT (code) DO NOTHING`
		const [row] = await sql<DepartmentIdRow[]>`SELECT id FROM department WHERE code = ${code}`
		if (row === undefined) {
			throw new Error(`department ${code} was neither created nor found`)
		}
		return row.id
	}

	// ADR-050
	async moveUser(sql: Executor, userId: string, departmentId: string, at: Date): Promise<void> {
		await sql`UPDATE app_user SET department_id = ${departmentId} WHERE id = ${userId}`
		await sql`
			UPDATE user_department_history SET valid_until = ${at}
			WHERE user_id = ${userId} AND valid_until IS NULL
		`
		await sql`
			INSERT INTO user_department_history (id, user_id, department_id, valid_from)
			VALUES (${randomUUID()}, ${userId}, ${departmentId}, ${at})
		`
	}
}
