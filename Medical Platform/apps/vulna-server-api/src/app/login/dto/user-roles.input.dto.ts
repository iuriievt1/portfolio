import type { AdministrationContract } from "@ansora/contracts"
import { ROLE } from "@ansora/core-server"
import { z } from "zod"

export type UserRolesInput =
	AdministrationContract.operations["setUserRoles"]["requestBody"]["content"]["application/json"]

const ROLE_CODES = Object.values(ROLE)

export const userRolesSchema = z.strictObject({
	roles: z
		.array(z.enum(ROLE_CODES))
		.max(ROLE_CODES.length)
		.refine((roles) => new Set(roles).size === roles.length),
}) satisfies z.ZodType<UserRolesInput>
