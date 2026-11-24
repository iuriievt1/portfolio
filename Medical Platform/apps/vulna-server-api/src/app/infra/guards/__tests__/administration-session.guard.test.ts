import { ADMINISTRATION_ERROR_CODE, BACKGROUND_REFRESH, BACKGROUND_REFRESH_HEADER } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { describe, expect, it } from "vitest"
import { KeepsIdleTime } from "../../../administration-session/decorators/keeps-idle-time.decorator"
import { RequiresPermission } from "../../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSessionService } from "../../../administration-session/services/administration-session.service"
import type {
	AdministrationRequest,
	AdministrationSession,
} from "../../../administration-session/types/administration-session.types"
import { ProblemException } from "../../exceptions/problem.exception"
import { AdministrationSessionGuard } from "../administration-session.guard"

const SESSION: AdministrationSession = {
	sessionId: "session-1",
	userId: "user-1",
	permissions: [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.DEVICES_MANAGE],
}
const KNOWN_COOKIE = "vulna_admin_session=known"

@RequiresPermission(PERMISSION.DEVICES_MANAGE)
class DevicesController {
	list(): void {}

	@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
	issueQrCode(): void {}
}

class SessionController {}

function contextOf(
	cookie: string | undefined,
	handler: () => void = () => undefined,
	controller: abstract new () => unknown = SessionController,
): { context: ExecutionContext; request: AdministrationRequest } {
	const headers: Record<string, string> = cookie === undefined ? {} : { cookie }
	const request = {
		method: "GET",
		headers,
		get: (name: string) => headers[name.toLowerCase()],
	} as unknown as AdministrationRequest
	const context = {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => handler,
		getClass: () => controller,
	} as unknown as ExecutionContext
	return { context, request }
}

function guardWith(
	sessions: Record<string, AdministrationSession>,
	idleReads: boolean[] = [],
): AdministrationSessionGuard {
	const service = {
		resolve: async (token: string, keepsIdleTime: boolean) => {
			idleReads.push(keepsIdleTime)
			return sessions[token]
		},
	} as AdministrationSessionService
	return new AdministrationSessionGuard(service, new Reflector())
}

async function rejection(guard: AdministrationSessionGuard, context: ExecutionContext): Promise<ProblemException> {
	const error: unknown = await guard.canActivate(context).catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the guard let the request through")
	}
	return error
}

describe("administration session guard", () => {
	it("rejects a request without the session cookie with 401 reauthentication-required", async () => {
		const error = await rejection(guardWith({}), contextOf(undefined).context)
		expect(error.getStatus()).toBe(401)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
	})

	it("rejects a cookie the server does not know", async () => {
		const error = await rejection(guardWith({}), contextOf("vulna_admin_session=unknown").context)
		expect(error.getStatus()).toBe(401)
	})

	it("lets a known session through and attaches it to the request", async () => {
		const { context, request } = contextOf(KNOWN_COOKIE)
		await expect(guardWith({ known: SESSION }).canActivate(context)).resolves.toBe(true)
		expect(request.administrationSession).toEqual(SESSION)
	})

	it("CAP-004-R11 tells the session that a marked read does not count as the administrator's action", async () => {
		const idleReads: boolean[] = []
		const marked = () => undefined
		KeepsIdleTime()(marked)
		await guardWith({ known: SESSION }, idleReads).canActivate(contextOf(KNOWN_COOKIE, marked).context)
		await guardWith({ known: SESSION }, idleReads).canActivate(contextOf(KNOWN_COOKIE).context)
		expect(idleReads).toEqual([true, false])
	})

	it("CAP-004-S11 does not count a background refresh as the administrator's action, but an action still counts", async () => {
		const idleReads: boolean[] = []
		const refresh = contextOf(KNOWN_COOKIE)
		refresh.request.headers[BACKGROUND_REFRESH_HEADER.toLowerCase()] = BACKGROUND_REFRESH
		const action = contextOf(KNOWN_COOKIE)
		action.request.headers[BACKGROUND_REFRESH_HEADER.toLowerCase()] = BACKGROUND_REFRESH
		action.request.method = "POST"
		await guardWith({ known: SESSION }, idleReads).canActivate(refresh.context)
		await guardWith({ known: SESSION }, idleReads).canActivate(action.context)
		expect(idleReads).toEqual([true, false])
	})

	it("lets through an operation whose permission the session holds", async () => {
		const { context } = contextOf(KNOWN_COOKIE, DevicesController.prototype.list, DevicesController)
		await expect(guardWith({ known: SESSION }).canActivate(context)).resolves.toBe(true)
	})

	it("CAP-012-S06 refuses an operation whose permission the session lacks with 403 permission-denied", async () => {
		const { context, request } = contextOf(KNOWN_COOKIE, DevicesController.prototype.issueQrCode, DevicesController)
		const error = await rejection(guardWith({ known: SESSION }), context)
		expect(error.getStatus()).toBe(403)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(request.administrationSession).toBeUndefined()
	})

	it("asks the operation's own permission before the controller's", async () => {
		const credentialsOnly = {
			...SESSION,
			permissions: [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.CREDENTIALS_MANAGE],
		}
		const { context } = contextOf(KNOWN_COOKIE, DevicesController.prototype.issueQrCode, DevicesController)
		await expect(guardWith({ known: credentialsOnly }).canActivate(context)).resolves.toBe(true)
	})
})
