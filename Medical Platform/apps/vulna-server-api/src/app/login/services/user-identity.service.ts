import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	type AuthenticatedIdentity,
	DEPARTMENT_ORIGIN,
	effectiveRoles,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityProviderPort,
	isAuthorizedMember,
	isPermission,
	type Permission,
	ROLE_ORIGIN,
	type Role,
	rolesFromGroups,
	sameRoles,
} from "@ansora/core-server"
import { Inject, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { IDENTITY_PROVIDER } from "../../../libs/identity-provider/identity-provider.module"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import { OUTSIDE_AUTHORIZED_GROUP } from "../constants/login-failure.constants"
import { AppUserRepository } from "../repositories/app-user.repository"
import type { AppUser, ProviderConfirmation } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"
import { departmentOfIdentity } from "../utils/department-of-identity"
import { directoryAccountOf } from "../utils/directory-account-of-identity"
import { groupsOfIdentity } from "../utils/identity-groups"
import { roleAssignmentOf } from "../utils/role-assignment"
import { UserDepartmentService } from "./user-department.service"

@Injectable()
export class UserIdentityService {
	constructor(
		private readonly database: DatabaseService,
		private readonly users: AppUserRepository,
		private readonly audit: AuditRepository,
		private readonly userDepartments: UserDepartmentService,
		private readonly actorTasks: ActorTaskRepository,
		@Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProviderPort,
	) {}

	async establish(
		sql: postgres.TransactionSql,
		identity: AuthenticatedIdentity,
		personalNumber: string,
		policy: LoginPolicy,
		now: Date,
	): Promise<AppUser> {
		const groups = groupsOfIdentity(identity, policy)
		const known = await this.users.findIdentity(this.provider.issuer(), identity.subjectId, sql)
		const previousName = known === undefined ? undefined : (await this.users.findById(known.userId))?.displayName
		const account = directoryAccountOf(identity, policy)
		const user = await this.users.establish(sql, this.provider.issuer(), identity, personalNumber, account, groups, now)
		// CAP-001-R31
		if (previousName !== user.displayName) {
			await this.actorTasks.enqueue(sql, user.id)
		}
		await this.applyGroupRoles(sql, user.id, groups, policy)
		await this.applyDirectoryDepartment(sql, user.id, identity, policy, now)
		return user
	}

	async findKnownUser(identity: AuthenticatedIdentity): Promise<AppUser | undefined> {
		const known = await this.users.findIdentity(this.provider.issuer(), identity.subjectId)
		return known === undefined ? undefined : await this.users.findById(known.userId)
	}

	async rolesOf(sql: Executor, userId: string): Promise<Role[]> {
		const { group, manual } = roleAssignmentOf(await this.users.rolesOf(sql, userId))
		return effectiveRoles(group, manual)
	}

	// CAP-003-R13
	async permissionsOf(sql: Executor, userId: string): Promise<Permission[]> {
		const granted = await this.users.permissionsOf(sql, userId)
		return granted.map((permission) => {
			if (!isPermission(permission)) {
				throw new Error(`user ${userId} holds permission ${permission}, which the catalog does not know`)
			}
			return permission
		})
	}

	async confirmWithProvider(user: AppUser, policy: LoginPolicy, now: Date): Promise<ProviderConfirmation> {
		const identity = await this.users.identityOfUser(user.id)
		if (identity === undefined || identity.refreshToken === null) {
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED }
		}
		const outcome = await this.provider.refresh(identity.refreshToken)
		if (!outcome.ok) {
			return { ok: false, failure: outcome.failure }
		}
		const refreshed = outcome.refreshed.identity
		const groups = refreshed === undefined ? undefined : groupsOfIdentity(refreshed, policy)
		await this.database.sql.begin(async (tx) => {
			await this.users.saveRefreshedIdentity(tx, identity.id, outcome.refreshed.refreshToken, groups, now)
			if (groups !== undefined) {
				await this.applyGroupRoles(tx, user.id, groups, policy)
			}
		})
		// Q-144
		if (!isAuthorizedMember(groups ?? identity.groups, policy.authorizedGroup)) {
			return { ok: false, failure: OUTSIDE_AUTHORIZED_GROUP }
		}
		return { ok: true }
	}

	// CAP-001-R31, CAP-003-R07
	private async applyDirectoryDepartment(
		sql: postgres.TransactionSql,
		userId: string,
		identity: AuthenticatedIdentity,
		policy: LoginPolicy,
		now: Date,
	): Promise<void> {
		const code = departmentOfIdentity(identity, policy)
		if (code === undefined) {
			return
		}
		await this.userDepartments.assign(sql, {
			userId,
			code,
			origin: DEPARTMENT_ORIGIN.DIRECTORY,
			actorUserId: userId,
			at: now,
		})
	}

	private async applyGroupRoles(
		sql: postgres.TransactionSql,
		userId: string,
		groups: readonly string[],
		policy: LoginPolicy,
	): Promise<void> {
		const previous = (await this.users.rolesOf(sql, userId))
			.filter((row) => row.origin === ROLE_ORIGIN.GROUP)
			.map((row) => row.role)
		const next = rolesFromGroups(groups, policy.groupToRole)
		if (sameRoles(previous, next)) {
			return
		}
		await this.users.replaceRoles(sql, userId, ROLE_ORIGIN.GROUP, next)
		// CAP-001-R31, ADR-053 bod 6
		await this.actorTasks.enqueue(sql, userId)
		await this.audit.append(sql, {
			eventType: AUDIT_EVENT_TYPE.USER_ROLES_CHANGED,
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: userId,
			objectId: userId,
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: { origin: ROLE_ORIGIN.GROUP, previous_roles: [...previous], roles: [...next] },
		})
	}
}
