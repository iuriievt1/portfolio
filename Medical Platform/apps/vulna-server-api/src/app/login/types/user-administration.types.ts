import type { AdministrationContract } from "@ansora/contracts"
import type { Role, RoleOrigin } from "@ansora/core-server"
import type { AppUser } from "./login.types"

type Schemas = AdministrationContract.components["schemas"]

export type UserView = Schemas["User"]

export type UsersPage = Schemas["UsersPage"]

export type CardView = Schemas["Card"]

export type QrCodeView = Schemas["QrCode"]

export type RoleView = Schemas["Role"]

export interface RoleRow {
	code: string
	name: string
}

export interface UserPage {
	users: AppUser[]
	hasMore: boolean
}

export interface UserRoleOfRow {
	user_id: string
	role: Role
	origin: RoleOrigin
}

// CAP-003-R03, CAP-003-R12
export interface RoleAssignment {
	group: Role[]
	manual: Role[]
}

export interface UserAccess {
	roles: RoleAssignment
	department: string | null
	departmentFromDirectory: boolean
}

export interface UserCardRow {
	id: string
	short_uid: string
	bound_at: Date
	revoked_at: Date | null
}

export interface UserQrCodeRow {
	id: string
	issued_at: Date
	revoked_at: Date | null
}

export interface UserPageQuery {
	limit: number
	cursor: string | undefined
	search: string | undefined
}

export interface NewQrCode {
	userId: string
	identifier: string
	keyVersion: number
	issuedByUserId: string
	issuedAt: Date
}

export interface IssuedQrCodeRow {
	id: string
	issued_at: Date
}
