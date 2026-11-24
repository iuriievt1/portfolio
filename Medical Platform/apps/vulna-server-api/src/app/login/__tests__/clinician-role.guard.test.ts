import { ERROR_CODE } from "@ansora/contracts"
import { ROLE, type Role } from "@ansora/core-server"
import type { ExecutionContext } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { ClinicianRoleGuard } from "../guards/clinician-role.guard"
import type { UserIdentityService } from "../services/user-identity.service"
import type { CurrentSession, UserSessionRequest } from "../types/login.types"

const USER_ID = "22222222-2222-4222-8222-222222222222"

function guardFor(roles: Role[]): ClinicianRoleGuard {
	const identities = { rolesOf: async () => roles } as unknown as UserIdentityService
	return new ClinicianRoleGuard({ sql: {} } as unknown as DatabaseService, identities)
}

function contextOf(current: CurrentSession | undefined): ExecutionContext {
	const request = { userSession: current } as UserSessionRequest
	return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext
}

const SIGNED_IN = { session: { userId: USER_ID } } as CurrentSession

describe("ClinicianRoleGuard", () => {
	it("lets a clinician capture", async () => {
		await expect(guardFor([ROLE.CLINICIAN]).canActivate(contextOf(SIGNED_IN))).resolves.toBe(true)
	})

	it("CAP-003-S06 refuses capture to a user who is only an administrator", async () => {
		const error: unknown = await guardFor([ROLE.ADMINISTRATOR])
			.canActivate(contextOf(SIGNED_IN))
			.catch((caught: unknown) => caught)
		expect(error instanceof ProblemException && error.getStatus()).toBe(403)
		expect(error instanceof ProblemException && error.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-003-S04 refuses capture to a user without any role", async () => {
		await expect(guardFor([]).canActivate(contextOf(SIGNED_IN))).rejects.toBeInstanceOf(ProblemException)
	})

	it("runs only behind the user session guard", async () => {
		await expect(guardFor([ROLE.CLINICIAN]).canActivate(contextOf(undefined))).rejects.toThrow(
			"the clinician role is checked only after the user session guard",
		)
	})
})
