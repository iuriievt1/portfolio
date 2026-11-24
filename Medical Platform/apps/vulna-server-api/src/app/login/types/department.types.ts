import type { AdministrationContract } from "@ansora/contracts"
import type { DepartmentOrigin } from "@ansora/core-server"

export type UserDepartmentInput =
	AdministrationContract.operations["setUserDepartment"]["requestBody"]["content"]["application/json"]

export interface DepartmentChange {
	userId: string
	code: string
	origin: DepartmentOrigin
	actorUserId: string
	at: Date
}

export interface DepartmentIdRow {
	id: string
}

export interface DepartmentCodeRow {
	code: string | null
}

export interface UserDepartmentRow {
	user_id: string
	code: string
}
