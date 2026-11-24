import { ADMINISTRATION_ERROR_CODE, CARRIER_STATE, USER_STATE } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	DEPARTMENT_ORIGIN,
	effectiveRoles,
	isRole,
	ROLE_ORIGIN,
	type Role,
	sameRoles,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { QrCodeKeyService } from "../../../libs/qr-code/qr-code-key.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import type { UserPageInput } from "../dto/user-page.input.dto"
import { AppUserRepository, encodeUserCursor } from "../repositories/app-user.repository"
import { CardRepository } from "../repositories/card.repository"
import { DepartmentRepository } from "../repositories/department.repository"
import { RoleRepository } from "../repositories/role.repository"
import type { AppUser } from "../types/login.types"
import type {
	CardView,
	QrCodeView,
	RoleRow,
	RoleView,
	UserAccess,
	UserCardRow,
	UserQrCodeRow,
	UsersPage,
	UserView,
} from "../types/user-administration.types"
import { isDepartmentFromDirectory } from "../utils/department-from-directory"
import { roleAssignmentOf } from "../utils/role-assignment"
import { CarrierRevocationService } from "./carrier-revocation.service"
import { LoginPolicyService } from "./login-policy.service"
import { UserDepartmentService } from "./user-department.service"

@Injectable()
export class UserAdministrationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly users: AppUserRepository,
		private readonly roleRepository: RoleRepository,
		private readonly departments: DepartmentRepository,
		private readonly userDepartments: UserDepartmentService,
		private readonly loginPolicy: LoginPolicyService,
		private readonly cards: CardRepository,
		private readonly qrKeys: QrCodeKeyService,
		private readonly audit: AuditRepository,
		private readonly configuration: ConfigurationService,
		private readonly actorTasks: ActorTaskRepository,
		private readonly carriers: CarrierRevocationService,
	) {}

	async list(query: UserPageInput): Promise<UsersPage> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const page = await this.users.page({ limit, cursor: query.cursor, search: query.search })
		const last = page.users.at(-1)
		return {
			items: await this.viewsOf(page.users),
			next_cursor: page.hasMore && last !== undefined ? encodeUserCursor(last) : null,
		}
	}

	async detail(id: string): Promise<UserView> {
		const [view] = await this.viewsOf([await this.user(id)])
		if (view === undefined) {
			throw new Error(`the view of user ${id} is missing`)
		}
		return view
	}

	async listRoles(): Promise<RoleView[]> {
		return (await this.roleRepository.list()).map(roleView)
	}

	// CAP-003-R03, CAP-003-R11
	async setManualRoles(
		userId: string,
		manualRoles: readonly Role[],
		administrator: AdministrationSession,
	): Promise<UserView> {
		const user = await this.user(userId)
		await this.database.sql.begin(async (tx) => {
			const previous = (await this.users.rolesOf(tx, user.id))
				.filter((row) => row.origin === ROLE_ORIGIN.MANUAL)
				.map((row) => row.role)
			if (sameRoles(previous, manualRoles)) {
				return
			}
			await this.users.replaceRoles(tx, user.id, ROLE_ORIGIN.MANUAL, manualRoles)
			// ADR-053 bod 6
			await this.actorTasks.enqueue(tx, user.id)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.USER_ROLES_CHANGED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: user.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { origin: ROLE_ORIGIN.MANUAL, previous_roles: [...previous], roles: [...manualRoles] },
			})
		})
		return await this.detail(user.id)
	}

	// CAP-003-R07, Q-048
	async setDepartment(userId: string, code: string, administrator: AdministrationSession): Promise<UserView> {
		const user = await this.user(userId)
		if (isDepartmentFromDirectory(await this.loginPolicy.current())) {
			throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.DEPARTMENT_FROM_DIRECTORY)
		}
		await this.database.sql.begin(async (tx) => {
			await this.userDepartments.assign(tx, {
				userId: user.id,
				code,
				origin: DEPARTMENT_ORIGIN.MANUAL,
				actorUserId: administrator.userId,
				at: new Date(),
			})
		})
		return await this.detail(user.id)
	}

	async cardsOf(userId: string): Promise<CardView[]> {
		const user = await this.user(userId)
		return (await this.cards.cardsOf(user.id)).map(cardView)
	}

	async qrCodesOf(userId: string): Promise<QrCodeView[]> {
		const user = await this.user(userId)
		return (await this.cards.qrCodesOf(user.id)).map(qrCodeView)
	}

	async issueQrCode(userId: string, administrator: AdministrationSession): Promise<QrCodeView> {
		const user = await this.user(userId)
		if (!user.isActive) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ADMINISTRATION_ERROR_CODE.RECORD_REJECTED)
		}
		const signed = this.qrKeys.issue()
		const now = new Date()
		const issued = await this.database.sql.begin(async (tx) => {
			// CAP-005-R12
			if (!(await this.users.lockActive(tx, user.id))) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ADMINISTRATION_ERROR_CODE.RECORD_REJECTED)
			}
			await this.carriers.revokeQrCodesOf(tx, user.id, administrator, now)
			const row = await this.cards.insertQrCode(tx, {
				userId: user.id,
				identifier: signed.identifier,
				keyVersion: signed.keyVersion,
				issuedByUserId: administrator.userId,
				issuedAt: now,
			})
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.QR_CODE_ISSUED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: row.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { user_id: user.id, key_version: signed.keyVersion },
			})
			return row
		})
		return {
			id: issued.id,
			issued_at: issued.issued_at.toISOString(),
			state: CARRIER_STATE.VALID,
			print_content: signed.content,
		}
	}

	private async user(id: string): Promise<AppUser> {
		const user = await this.users.findById(id)
		if (user === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		return user
	}

	private async viewsOf(users: readonly AppUser[]): Promise<UserView[]> {
		const userIds = users.map((user) => user.id)
		const roleRows = await this.users.rolesOfUsers(userIds)
		const departments = await this.departments.codesOfUsers(userIds)
		const departmentFromDirectory = isDepartmentFromDirectory(await this.loginPolicy.current())
		return users.map((user) =>
			userView(user, {
				roles: roleAssignmentOf(roleRows.filter((row) => row.user_id === user.id)),
				department: departments.get(user.id) ?? null,
				departmentFromDirectory,
			}),
		)
	}
}

function userView(user: AppUser, access: UserAccess): UserView {
	return {
		id: user.id,
		display_name: user.displayName,
		personal_number: user.personalNumber ?? undefined,
		login_name: user.loginName,
		email: user.email,
		department: access.department,
		department_from_directory: access.departmentFromDirectory,
		roles: effectiveRoles(access.roles.group, access.roles.manual),
		group_roles: access.roles.group,
		manual_roles: access.roles.manual,
		state: user.isActive ? USER_STATE.ACTIVE : USER_STATE.REVOKED,
	}
}

function roleView(row: RoleRow): RoleView {
	if (!isRole(row.code)) {
		throw new Error(`role ${row.code} is outside the roles of the contract`)
	}
	return { code: row.code, name: row.name }
}

function qrCodeView(row: UserQrCodeRow): QrCodeView {
	return {
		id: row.id,
		issued_at: row.issued_at.toISOString(),
		state: row.revoked_at === null ? CARRIER_STATE.VALID : CARRIER_STATE.REVOKED,
	}
}

function cardView(row: UserCardRow): CardView {
	return {
		id: row.id,
		short_uid: row.short_uid,
		created_at: row.bound_at.toISOString(),
		state: row.revoked_at === null ? CARRIER_STATE.VALID : CARRIER_STATE.REVOKED,
	}
}
