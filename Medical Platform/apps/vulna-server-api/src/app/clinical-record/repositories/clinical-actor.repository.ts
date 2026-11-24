import type { ActorDepartment, ClinicalActor } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { ActorRoleRow, ActorRow } from "../types/clinical-record.types"

// CAP-021-R38, ADR-053 bod 6
@Injectable()
export class ClinicalActorRepository {
	constructor(private readonly database: DatabaseService) {}

	async actorOf(userId: string): Promise<ClinicalActor | undefined> {
		const sql = this.database.sql
		const [row] = await sql<ActorRow[]>`
			SELECT u.display_name, d.id AS department_id, d.code AS department_code
			FROM app_user u
			LEFT JOIN department d ON d.id = u.department_id
			WHERE u.id = ${userId}
		`
		if (row === undefined) {
			return undefined
		}
		// CAP-003-R03
		const roles = await sql<ActorRoleRow[]>`SELECT DISTINCT role FROM user_role WHERE user_id = ${userId} ORDER BY role`
		return {
			userId,
			displayName: row.display_name,
			department:
				row.department_id === null || row.department_code === null
					? undefined
					: { id: row.department_id, code: row.department_code },
			roles: roles.map((role) => role.role),
		}
	}

	// ADR-050, datovy-model.md 4
	async departmentAt(sql: Executor, userId: string, moment: Date): Promise<ActorDepartment | undefined> {
		const [row] = await sql<ActorDepartment[]>`
			SELECT d.id, d.code
			FROM user_department_history h
			JOIN department d ON d.id = h.department_id
			WHERE h.user_id = ${userId}
				AND h.valid_from <= ${moment}
				AND (h.valid_until IS NULL OR h.valid_until > ${moment})
			ORDER BY h.valid_from DESC
			LIMIT 1
		`
		return row
	}

	// CAP-014-R17
	async departmentOf(sql: Executor, departmentId: string | null): Promise<ActorDepartment | undefined> {
		if (departmentId === null) {
			return undefined
		}
		const [row] = await sql<ActorDepartment[]>`SELECT id, code FROM department WHERE id = ${departmentId}`
		return row
	}
}
