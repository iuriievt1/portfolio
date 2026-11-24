import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type User = Schemas["User"]

export type UsersPage = Schemas["UsersPage"]

export type Card = Schemas["Card"]

export type CardBindingCode = Schemas["CardBindingCode"]

export type QrCode = Schemas["QrCode"]

export type UserRolesRequest =
	AdministrationContract.operations["setUserRoles"]["requestBody"]["content"]["application/json"]

export type UserDepartmentRequest =
	AdministrationContract.operations["setUserDepartment"]["requestBody"]["content"]["application/json"]
