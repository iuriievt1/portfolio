import "reflect-metadata"
import { BEARER_PREFIX, ERROR_CODE } from "@ansora/contracts"
import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { describe, expect, it } from "vitest"
import type { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AcceptsExpiredToken } from "../decorators/accepts-expired-token.decorator"
import { UserSessionGuard } from "../guards/user-session.guard"
import type { SessionService } from "../services/session.service"
import type { UserSession, UserSessionRequest } from "../types/login.types"

const TOKEN = "session-token"
const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const MINUTE = 60_000

class SessionController {
	terminate(): boolean {
		return true
	}

	@AcceptsExpiredToken()
	refresh(): boolean {
		return true
	}
}

const controller = new SessionController()

function sessionWith(overrides: Partial<UserSession>): UserSession {
	const now = Date.now()
	return {
		id: "11111111-1111-4111-8111-111111111111",
		userId: "22222222-2222-4222-8222-222222222222",
		deviceId: DEVICE_ID,
		tokenExpiresAt: new Date(now + MINUTE),
		startedAt: new Date(now - MINUTE),
		sessionEnd: new Date(now + 60 * MINUTE),
		endedAt: null,
		...overrides,
	}
}

function guardFor(session: UserSession): UserSessionGuard {
	const sessions = { resolve: async (token: string) => (token === TOKEN ? session : undefined) } as SessionService
	const proofs = { ofApprovedDevice: async () => ({ id: DEVICE_ID }) as Device } as unknown as DeviceProofService
	return new UserSessionGuard(sessions, proofs, new Reflector())
}

function contextOf(handler: () => boolean): ExecutionContext {
	const request = { headers: { authorization: `${BEARER_PREFIX}${TOKEN}` } } as UserSessionRequest
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => handler,
	} as unknown as ExecutionContext
}

async function rejection(guard: UserSessionGuard, context: ExecutionContext): Promise<ProblemException> {
	const error: unknown = await guard.canActivate(context).catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the guard let the request through")
	}
	return error
}

describe("user session guard", () => {
	it("lets a live token of an active session through", async () => {
		await expect(guardFor(sessionWith({})).canActivate(contextOf(controller.terminate))).resolves.toBe(true)
	})

	it("CAP-002-S34 rejects an expired token outside the refresh with reauthentication-required", async () => {
		const guard = guardFor(sessionWith({ tokenExpiresAt: new Date(Date.now() - MINUTE) }))
		const error = await rejection(guard, contextOf(controller.terminate))
		expect(error.getStatus()).toBe(401)
		expect(error.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
	})

	it("CAP-002-S04 accepts an expired token for the refresh while the session lasts", async () => {
		const guard = guardFor(sessionWith({ tokenExpiresAt: new Date(Date.now() - MINUTE) }))
		await expect(guard.canActivate(contextOf(controller.refresh))).resolves.toBe(true)
	})

	it("CAP-002-S06 rejects every operation once the session has run out, the refresh too", async () => {
		const guard = guardFor(sessionWith({ sessionEnd: new Date(Date.now() - MINUTE) }))
		expect((await rejection(guard, contextOf(controller.refresh))).code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect((await rejection(guard, contextOf(controller.terminate))).code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
	})

	it("CAP-002-S02 rejects an ended session", async () => {
		const guard = guardFor(sessionWith({ endedAt: new Date(Date.now() - MINUTE) }))
		expect((await rejection(guard, contextOf(controller.refresh))).code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
	})
})
