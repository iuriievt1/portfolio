import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	type AuthenticatedIdentity,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityProviderPort,
	MILLISECONDS_PER_SECOND,
	PERMISSION,
	type Permission,
} from "@ansora/core-server"
import { Logger } from "@nestjs/common"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AdministrationLoginFlowRepository } from "../repositories/administration-login-flow.repository"
import { AdministrationLoginService } from "../services/administration-login.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import type { UserIdentityService } from "../services/user-identity.service"
import type { AppUser } from "../types/login.types"

const STATE = "state-1"
const USER: AppUser = {
	id: "11111111-1111-4111-8111-111111111111",
	personalNumber: "000102",
	displayName: "Petr Svoboda",
	isActive: true,
	loginName: null,
	email: null,
	preferredLanguage: null,
}
const ISSUED = { sessionId: "33333333-3333-4333-8333-333333333333", token: "token", expiresAt: new Date() }
const AUTHORIZED_GROUP = "vulna-users"
const FLOW_STARTED_AT = new Date("2026-10-06T08:05:00.000Z")
const EARLIER_SIGN_IN = Math.floor(new Date("2026-10-06T07:05:00.000Z").getTime() / MILLISECONDS_PER_SECOND)

function identity(groups: string[] = [AUTHORIZED_GROUP]): AuthenticatedIdentity {
	return {
		subjectId: "subject",
		displayName: USER.displayName,
		givenName: undefined,
		familyName: undefined,
		authTime: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
		claims: { personal_number: USER.personalNumber, groups },
		refreshToken: undefined,
	}
}

interface Options {
	permissions?: Permission[]
	user?: AppUser
	knownUser?: AppUser
	flowOpen?: boolean
	flowStartedAt?: Date
	provider?: Partial<IdentityProviderPort>
}

function harnessWith(options: Options = {}) {
	const audited: NewAuditEvent[] = []
	const issued: string[] = []
	const established: string[] = []
	const flows = {
		deleteExpired: async () => undefined,
		insert: async () => undefined,
		take: async () =>
			options.flowOpen === false
				? undefined
				: { code_verifier: "verifier", nonce: "nonce", started_at: options.flowStartedAt ?? new Date() },
	} as unknown as AdministrationLoginFlowRepository
	const identities = {
		findKnownUser: async () => options.knownUser,
		establish: async () => {
			const user = options.user ?? USER
			established.push(user.id)
			return user
		},
		permissionsOf: async () => options.permissions ?? [PERMISSION.ADMINISTRATION_ACCESS],
	} as unknown as UserIdentityService
	const policies = {
		current: async () => ({
			personalNumberClaim: "personal_number",
			groupClaim: "groups",
			authorizedGroup: AUTHORIZED_GROUP,
			groupToRole: [],
		}),
	} as unknown as LoginPolicyService
	const sessions = {
		issue: async (_tx: never, userId: string) => {
			issued.push(userId)
			return ISSUED
		},
	} as unknown as AdministrationSessionService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const provider: IdentityProviderPort = {
		issuer: () => "issuer",
		authorizationUrl: async () => "https://idp.invalid/authorize",
		exchangeCode: async () => ({ ok: true, identity: identity() }),
		refresh: async () => ({ ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED, detail: "" }),
		...options.provider,
	}
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const service = new AdministrationLoginService(database, flows, identities, policies, sessions, audit, provider)
	return { service, audited, issued, established }
}

const RETURN = { state: STATE, code: "code", error: undefined, errorDescription: undefined }

async function refusal(work: Promise<unknown>): Promise<ProblemException> {
	const error = await work.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the login went through")
	}
	return error
}

describe("AdministrationLoginService", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("CAP-004-S01 opens a browser session for an administrator and records the access", async () => {
		const { service, audited, issued } = harnessWith()

		expect(await service.complete(RETURN)).toEqual(ISSUED)
		expect(issued).toEqual([USER.id])
		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.LOGIN, actorUserId: USER.id, outcome: AUDIT_OUTCOME.SUCCESS },
		])
	})

	it("CAP-004-S03 CAP-005-S07 CAP-012-S06 refuses a user without administration access and records the attempt", async () => {
		const { service, audited, issued } = harnessWith({ permissions: [] })

		const error = await refusal(service.complete(RETURN))

		expect(error.getStatus()).toBe(403)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(issued).toEqual([])
		expect(audited).toMatchObject([{ eventType: AUDIT_EVENT_TYPE.LOGIN, outcome: AUDIT_OUTCOME.FAILURE }])
	})

	it("refuses a deactivated account even with the administrator role", async () => {
		const { service, issued } = harnessWith({ user: { ...USER, isActive: false } })
		expect((await refusal(service.complete(RETURN))).code).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(issued).toEqual([])
	})

	it("CAP-003-S09 refuses a user outside the authorized group and records the attempt", async () => {
		const { service, audited, issued } = harnessWith({
			provider: { exchangeCode: async () => ({ ok: true, identity: identity(["vulna-clinicians"]) }) },
		})

		const error = await refusal(service.complete(RETURN))

		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(issued).toEqual([])
		expect(audited).toMatchObject([
			{
				eventType: AUDIT_EVENT_TYPE.LOGIN,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: { reason: "outside_authorized_group" },
			},
		])
	})

	it("refuses a provider return whose login flow is unknown, spent or expired", async () => {
		const { service } = harnessWith({ flowOpen: false })
		const error = await refusal(service.complete(RETURN))
		expect(error.getStatus()).toBe(401)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
	})

	it("CAP-004-S06 tells the administrator to retry while the identity provider is down", async () => {
		const down = harnessWith({
			provider: {
				authorizationUrl: async () => {
					throw new Error("connection refused")
				},
				exchangeCode: async () => ({ ok: false, failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE, detail: "down" }),
			},
		})

		expect((await refusal(down.service.start())).code).toBe(ADMINISTRATION_ERROR_CODE.RETRY)
		expect((await refusal(down.service.complete(RETURN))).getStatus()).toBe(503)
	})

	it("CAP-004-R09 refuses a sign-in the identity provider reused, warns in the log and records the attempt", async () => {
		const warnings = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
		const { service, audited, issued, established } = harnessWith({
			knownUser: USER,
			flowStartedAt: FLOW_STARTED_AT,
			provider: { exchangeCode: async () => ({ ok: true, identity: { ...identity(), authTime: EARLIER_SIGN_IN } }) },
		})

		const error = await refusal(service.complete(RETURN))

		expect(error.getStatus()).toBe(401)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
		expect(issued).toEqual([])
		expect(established).toEqual([])
		expect(audited).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.LOGIN,
				actorKind: "user",
				actorUserId: USER.id,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: { scope: "administration", method: "oidc", reason: "authentication_stale" },
			},
		])
		expect(warnings).toHaveBeenCalledWith(
			`Refused the administration login of user ${USER.id}: the identity provider last asked for the credentials at ` +
				"2026-10-06T07:05:00.000Z, 3600 s before the login started at 2026-10-06T08:05:00.000Z (tolerance 60 s), " +
				"so it reused an earlier sign-in despite prompt=login and max_age=0",
		)
	})

	it("refuses an ID token without auth_time from someone Vulna does not know, warns and creates no account", async () => {
		const warnings = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
		const { service, audited, issued, established } = harnessWith({
			provider: { exchangeCode: async () => ({ ok: true, identity: { ...identity(), authTime: undefined } }) },
		})

		const error = await refusal(service.complete(RETURN))

		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
		expect(issued).toEqual([])
		expect(established).toEqual([])
		expect(audited).toEqual([])
		expect(warnings).toHaveBeenCalledWith(
			"Refused the administration login of a user Vulna does not know yet: the identity provider returned an ID token " +
				"without auth_time although the login asked for max_age=0",
		)
		for (const [message] of warnings.mock.calls) {
			expect(String(message)).not.toContain(USER.personalNumber)
			expect(String(message)).not.toContain(USER.displayName)
		}
	})
})
