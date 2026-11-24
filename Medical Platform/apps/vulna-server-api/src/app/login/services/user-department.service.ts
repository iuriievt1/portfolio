import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import { DepartmentRepository } from "../repositories/department.repository"
import type { DepartmentChange } from "../types/department.types"

@Injectable()
export class UserDepartmentService {
	constructor(
		private readonly departments: DepartmentRepository,
		private readonly audit: AuditRepository,
		private readonly actorTasks: ActorTaskRepository,
	) {}

	// CAP-003-R07, CAP-003-R11
	async assign(sql: postgres.TransactionSql, change: DepartmentChange): Promise<void> {
		const previous = await this.departments.lockedCodeOf(sql, change.userId)
		if (previous === change.code) {
			return
		}
		const departmentId = await this.departments.ensure(sql, change.code)
		await this.departments.moveUser(sql, change.userId, departmentId, change.at)
		// CAP-001-R31, ADR-050 bod 5
		await this.actorTasks.enqueue(sql, change.userId)
		await this.audit.append(sql, {
			eventType: AUDIT_EVENT_TYPE.USER_DEPARTMENT_CHANGED,
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: change.actorUserId,
			objectId: change.userId,
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: { origin: change.origin, previous_department: previous, department: change.code },
		})
	}
}
