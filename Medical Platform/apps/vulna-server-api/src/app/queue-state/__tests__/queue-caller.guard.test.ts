import { BEARER_PREFIX, ERROR_CODE } from "@ansora/contracts"
import type { ExecutionContext } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DeviceTokenService } from "../../device/services/device-token.service"
import type { Device } from "../../device/types/device.types"
import type { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { SessionService } from "../../login/services/session.service"
import type { CurrentSession, UserSession } from "../../login/types/login.types"
import { signInAgain } from "../../login/utils/login-rejection"
import { QUEUE_CALLER } from "../constants/queue-state.constants"
import { QueueCallerGuard } from "../guards/queue-caller.guard"
import type { QueueCallerRequest } from "../types/queue-state.types"

const SESSION_TOKEN = "session-token"
const DEVICE_TOKEN = "device-token"
const DEVICE = { id: "33333333-3333-4333-8333-333333333333" } as Device
const SESSION = { id: "session", userId: "nurse", deviceId: DEVICE.id } as UserSession

interface Harness {
	guard: QueueCallerGuard
	request: QueueCallerRequest
	context: ExecutionContext
	provenTokens: string[]
}

interface HarnessState {
	isDeviceOfToken: boolean
	isSessionUsable: boolean
}

function harness(authorization: string | undefined, state: Partial<HarnessState> = {}): Harness {
	const { isDeviceOfToken = true, isSessionUsable = true } = state
	const request = { headers: { authorization } } as unknown as Harness["request"]
	const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext
	const provenTokens: string[] = []
	const sessions = {
		resolve: async (token: string) => (token === SESSION_TOKEN ? SESSION : undefined),
	} as unknown as SessionService
	const userSessions = {
		admit: async (_context: ExecutionContext, token: string, session: UserSession) => {
			if (!isSessionUsable) {
				throw signInAgain()
			}
			return { session, token, device: DEVICE } as CurrentSession
		},
	} as unknown as UserSessionGuard
	const deviceTokens = {
		provenDeviceOf: async (_request: unknown, token: string) => {
			provenTokens.push(token)
			if (!isDeviceOfToken) {
				throw signInAgain()
			}
			return DEVICE
		},
	} as unknown as DeviceTokenService
	return { guard: new QueueCallerGuard(sessions, userSessions, deviceTokens), request, context, provenTokens }
}

describe("caller of the queue state CAP-002-R09, NAB-297", () => {
	it("CAP-019-R30 asks in the session of the signed-in user", async () => {
		const run = harness(`${BEARER_PREFIX}${SESSION_TOKEN}`)

		await run.guard.canActivate(run.context)

		expect(run.request.queueCaller).toMatchObject({ kind: QUEUE_CALLER.USER, current: { session: SESSION } })
		expect(run.provenTokens).toEqual([])
	})

	it("CAP-019-S05 asks under the device token after the session ended", async () => {
		const run = harness(`${BEARER_PREFIX}${DEVICE_TOKEN}`)

		await run.guard.canActivate(run.context)

		expect(run.request.queueCaller).toEqual({ kind: QUEUE_CALLER.DEVICE, device: DEVICE })
		expect(run.provenTokens).toEqual([DEVICE_TOKEN])
	})

	it("ADR-013 refuses a device token that the signing device does not hold", async () => {
		const run = harness(`${BEARER_PREFIX}${DEVICE_TOKEN}`, { isDeviceOfToken: false })

		await expect(run.guard.canActivate(run.context)).rejects.toMatchObject({ code: ERROR_CODE.SIGN_IN_AGAIN })
		expect(run.request.queueCaller).toBeUndefined()
	})

	it("CAP-002-R09 refuses a session it cannot admit without falling back to the device token", async () => {
		const run = harness(`${BEARER_PREFIX}${SESSION_TOKEN}`, { isSessionUsable: false })

		await expect(run.guard.canActivate(run.context)).rejects.toMatchObject({ code: ERROR_CODE.SIGN_IN_AGAIN })
		expect(run.provenTokens).toEqual([])
		expect(run.request.queueCaller).toBeUndefined()
	})

	it("refuses a request without a token", async () => {
		const run = harness(undefined)

		await expect(run.guard.canActivate(run.context)).rejects.toMatchObject({ code: ERROR_CODE.SIGN_IN_AGAIN })
	})
})
