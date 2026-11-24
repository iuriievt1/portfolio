import { randomUUID } from "node:crypto"
import type { AuthenticatedIdentity, Role, RoleOrigin } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { containing } from "../../../libs/database/like-pattern"
import { decodePageCursor, encodePageCursor } from "../../infra/utils/page-cursor"
import type {
	AppUser,
	AppUserRow,
	DirectoryAccount,
	IdpIdentity,
	IdpIdentityRow,
	RolePermissionRow,
	UserRoleRow,
} from "../types/login.types"
import type { UserPage, UserPageQuery, UserRoleOfRow } from "../types/user-administration.types"

const USER_COLUMNS = [
	"id",
	"personal_number",
	"login_name",
	"email",
	"display_name",
	"is_active",
	"preferred_language",
] as const
const IDENTITY_COLUMNS = ["id", "user_id", "refresh_token", "groups"] as const

@Injectable()
export class AppUserRepository {
	constructor(private readonly database: DatabaseService) {}

	async findById(id: string): Promise<AppUser | undefined> {
		const [row] = await this.database.sql<AppUserRow[]>`
			SELECT ${this.database.sql(USER_COLUMNS)} FROM app_user WHERE id = ${id}
		`
		return row === undefined ? undefined : user(row)
	}

	// CAP-002-R08
	async lockActive(sql: Executor, id: string): Promise<boolean> {
		const [row] = await sql<{ is_active: boolean }[]>`SELECT is_active FROM app_user WHERE id = ${id} FOR SHARE`
		return row?.is_active === true
	}

	// CAP-005-R07
	async deactivate(sql: Executor, id: string): Promise<boolean> {
		const rows = await sql`UPDATE app_user SET is_active = false WHERE id = ${id} AND is_active RETURNING id`
		return rows.length > 0
	}

	async findByPersonalNumber(personalNumber: string): Promise<AppUser | undefined> {
		const [row] = await this.database.sql<AppUserRow[]>`
			SELECT ${this.database.sql(USER_COLUMNS)} FROM app_user WHERE personal_number = ${personalNumber}
		`
		return row === undefined ? undefined : user(row)
	}

	// identity.yaml loginWithBarcode, 0046-login-name-email.sql
	async findByLoginName(loginName: string): Promise<AppUser | undefined> {
		const [row] = await this.database.sql<AppUserRow[]>`
			SELECT ${this.database.sql(USER_COLUMNS)} FROM app_user WHERE lower(login_name) = lower(${loginName})
		`
		return row === undefined ? undefined : user(row)
	}

	async page(query: UserPageQuery): Promise<UserPage> {
		const sql = this.database.sql
		const after = decodePageCursor(query.cursor)
		const pattern = query.search === undefined ? undefined : containing(query.search)
		const bySearch =
			pattern === undefined ? sql`TRUE` : sql`(display_name ILIKE ${pattern} OR personal_number ILIKE ${pattern})`
		const afterCursor =
			after === undefined ? sql`TRUE` : sql`(display_name, id) > (${after.sortKey}, ${after.id}::uuid)`
		const rows = await sql<AppUserRow[]>`
			SELECT ${sql(USER_COLUMNS)} FROM app_user
			WHERE ${bySearch} AND ${afterCursor}
			ORDER BY display_name, id
			LIMIT ${query.limit + 1}
		`
		return { users: rows.slice(0, query.limit).map(user), hasMore: rows.length > query.limit }
	}

	async rolesOfUsers(userIds: readonly string[]): Promise<UserRoleOfRow[]> {
		if (userIds.length === 0) {
			return []
		}
		const sql = this.database.sql
		return await sql<UserRoleOfRow[]>`
			SELECT user_id, role, origin FROM user_role WHERE user_id IN ${sql(userIds)} ORDER BY user_id, role, origin
		`
	}

	async findIdentity(
		issuer: string,
		subject: string,
		sql: Executor = this.database.sql,
	): Promise<IdpIdentity | undefined> {
		const [row] = await sql<IdpIdentityRow[]>`
			SELECT ${sql(IDENTITY_COLUMNS)} FROM user_idp_identity WHERE issuer = ${issuer} AND subject = ${subject}
		`
		return row === undefined ? undefined : identity(row)
	}

	async identityOfUser(userId: string): Promise<IdpIdentity | undefined> {
		const [row] = await this.database.sql<IdpIdentityRow[]>`
			SELECT ${this.database.sql(IDENTITY_COLUMNS)} FROM user_idp_identity
			WHERE user_id = ${userId} ORDER BY last_authenticated_at DESC LIMIT 1
		`
		return row === undefined ? undefined : identity(row)
	}

	async establish(
		sql: Executor,
		issuer: string,
		authenticated: AuthenticatedIdentity,
		personalNumber: string,
		account: DirectoryAccount,
		groups: readonly string[],
		now: Date,
	): Promise<AppUser> {
		const existing = await this.findIdentity(issuer, authenticated.subjectId, sql)
		const userId = existing?.userId ?? randomUUID()
		if (account.loginName !== null) {
			await this.releaseLoginName(sql, account.loginName, userId)
		}
		const [userRow] = await sql<AppUserRow[]>`
			INSERT INTO app_user (id, given_name, family_name, display_name, personal_number, login_name, email)
			VALUES (
				${userId}, ${authenticated.givenName ?? ""}, ${authenticated.familyName ?? ""},
				${authenticated.displayName}, ${personalNumber}, ${account.loginName}, ${account.email}
			)
			ON CONFLICT (id) DO UPDATE SET
				given_name = EXCLUDED.given_name,
				family_name = EXCLUDED.family_name,
				display_name = EXCLUDED.display_name,
				personal_number = EXCLUDED.personal_number,
				login_name = EXCLUDED.login_name,
				email = EXCLUDED.email
			RETURNING ${sql(USER_COLUMNS)}
		`
		await sql`
			INSERT INTO user_idp_identity (id, user_id, issuer, subject, refresh_token, groups, last_authenticated_at)
			VALUES (
				${existing?.id ?? randomUUID()}, ${userId}, ${issuer}, ${authenticated.subjectId},
				${authenticated.refreshToken ?? null}, ${JSON.stringify(groups)}::text::jsonb, ${now}
			)
			ON CONFLICT (issuer, subject) DO UPDATE SET
				refresh_token = COALESCE(EXCLUDED.refresh_token, user_idp_identity.refresh_token),
				groups = EXCLUDED.groups,
				last_authenticated_at = EXCLUDED.last_authenticated_at
		`
		if (userRow === undefined) {
			throw new Error(`establishing the user of subject ${authenticated.subjectId} returned no row`)
		}
		return user(userRow)
	}

	async saveRefreshedIdentity(
		sql: Executor,
		identityId: string,
		refreshToken: string | undefined,
		groups: readonly string[] | undefined,
		now: Date,
	): Promise<void> {
		await sql`
			UPDATE user_idp_identity SET
				refresh_token = COALESCE(${refreshToken ?? null}, refresh_token),
				groups = COALESCE(${groups === undefined ? null : JSON.stringify(groups)}::text::jsonb, groups),
				last_authenticated_at = ${now}
			WHERE id = ${identityId}
		`
	}

	async setPreferredLanguage(userId: string, language: string): Promise<void> {
		await this.database.sql`UPDATE app_user SET preferred_language = ${language} WHERE id = ${userId}`
	}

	async rolesOf(sql: Executor, userId: string): Promise<UserRoleRow[]> {
		return await sql<UserRoleRow[]>`SELECT role, origin FROM user_role WHERE user_id = ${userId} ORDER BY role, origin`
	}

	async permissionsOf(sql: Executor, userId: string): Promise<string[]> {
		const rows = await sql<RolePermissionRow[]>`
			SELECT DISTINCT role_permission.permission FROM user_role
			JOIN role_permission ON role_permission.role_code = user_role.role
			WHERE user_role.user_id = ${userId}
			ORDER BY role_permission.permission
		`
		return rows.map((row) => row.permission)
	}

	async replaceRoles(sql: Executor, userId: string, origin: RoleOrigin, roles: readonly Role[]): Promise<void> {
		await sql`DELETE FROM user_role WHERE user_id = ${userId} AND origin = ${origin}`
		if (roles.length === 0) {
			return
		}
		const rows = roles.map((role) => ({ user_id: userId, role, origin }))
		await sql`INSERT INTO user_role ${sql(rows)}`
	}

	// administration.yaml User login_name, 0046-login-name-email.sql
	private async releaseLoginName(sql: Executor, loginName: string, userId: string): Promise<void> {
		await sql`UPDATE app_user SET login_name = NULL WHERE lower(login_name) = lower(${loginName}) AND id <> ${userId}`
	}
}

function user(row: AppUserRow): AppUser {
	return {
		id: row.id,
		personalNumber: row.personal_number,
		loginName: row.login_name,
		email: row.email,
		displayName: row.display_name,
		isActive: row.is_active,
		preferredLanguage: row.preferred_language,
	}
}

function identity(row: IdpIdentityRow): IdpIdentity {
	return {
		id: row.id,
		userId: row.user_id,
		refreshToken: row.refresh_token,
		groups: row.groups,
	}
}

export function encodeUserCursor(last: AppUser): string {
	return encodePageCursor({ sortKey: last.displayName, id: last.id })
}
