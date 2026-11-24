import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityProviderFailure,
	MILLISECONDS_PER_SECOND,
	PERMISSION,
	type Permission,
} from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../../login/repositories/app-user.repository"
import type { LoginPolicyService } from "../../login/services/login-policy.service"
import type { UserIdentityService } from "../../login/services/user-identity.service"
import { ADMINISTRATION_SESSION_END_REASON } from "../constants/administration-session.constants"
import type { AdministrationSessionRepository } from "../repositories/administration-session.repository"
import { AdministrationSessionService } from "../services/administration-session.service"
import type { AdministrationSessionRow } from "../types/administration-session.types"

const IDLE_LOGOUT_SECONDS = 1800
const SESSION_MAX_SECONDS = 28_800
const TOKEN_VALIDITY_SECONDS = 900
const SESSION_ID = "33333333-3333-4333-8333-333333333333"
const USER_ID = "11111111-1111-4111-8111-111111111111"

function secondsAgo(seconds: number): Date {
	return new Date(Date.now() - seconds * MILLISECONDS_PER_SECOND)
}

function sessionRow(overrides: Partial<AdministrationSessionRow> = {}): AdministrationSessionRow {
	return {
		id: SESSION_ID,
		user_id: USER_ID,
		last_activity_at: secondsAgo(60),
		confirmed_at: secondsAgo(60),
		expires_at: secondsAgo(-SESSION_MAX_SECONDS),
		ended_at: null,
		is_active: true,
		...overrides,
	}
}

const ADMINISTRATOR_PERMISSIONS: readonly Permission[] = [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.USERS_MANAGE]
const RESOLVED = { sessionId: SESSION_ID, userId: USER_ID, permissions: ADMINISTRATOR_PERMISSIONS }

interface Options {
	permissions?: readonly Permission[]
	providerFailure?: IdentityProviderFailure
}

function harnessWith(row: AdministrationSessionRow, options: Options = {}) {
	const ended: string[] = []
	const touched: string[] = []
	const audited: NewAuditEvent[] = []
	const confirmed: string[] = []
	const asked: string[] = []
	const sessions = {
		findByTokenHash: async () => row,
		confirm: async (id: string) => {
			confirmed.push(id)
		},
		touch: async (id: string) => {
			touched.push(id)
		},
		end: async (_sql: never, _id: string, reason: string) => {
			ended.push(reason)
			return true
		},
		endAllOf: async (_sql: never, userId: string, reason: string) => {
			ended.push(reason)
			return userId === row.user_id ? [row.id] : []
		},
	} as unknown as AdministrationSessionRepository
	const policies = {
		current: async () => ({
			session: { tokenValiditySeconds: TOKEN_VALIDITY_SECONDS },
			administration: { idleLogoutSeconds: IDLE_LOGOUT_SECONDS, sessionMaxSeconds: SESSION_MAX_SECONDS },
		}),
	} as unknown as LoginPolicyService
	const users = { findById: async (id: string) => ({ id, isActive: true }) } as unknown as AppUserRepository
	const identities = {
		permissionsOf: async () => options.permissions ?? ADMINISTRATOR_PERMISSIONS,
		confirmWithProvider: async (user: { id: string }) => {
			asked.push(user.id)
			return options.providerFailure === undefined ? { ok: true } : { ok: false, failure: options.providerFailure }
		},
	} as unknown as UserIdentityService
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const service = new AdministrationSessionService(database, sessions, policies, users, identities, audit)
	return { service, ended, touched, audited, confirmed, asked }
}

describe("AdministrationSessionService", () => {
	it("lets a fresh session through and counts the request as the administrator's action", async () => {
		const { service, touched, ended } = harnessWith(sessionRow())
		expect(await service.resolve("token", false)).toEqual(RESOLVED)
		expect(touched).toEqual([SESSION_ID])
		expect(ended).toEqual([])
	})

	it("CAP-004-R11 does not count a read of the session itself as an action", async () => {
		const { service, touched } = harnessWith(sessionRow())
		await service.resolve("token", true)
		expect(touched).toEqual([])
	})

	it("CAP-004-S07 ends the session after the idle time and records why", async () => {
		const { service, ended, audited } = harnessWith(sessionRow({ last_activity_at: secondsAgo(IDLE_LOGOUT_SECONDS) }))
		expect(await service.resolve("token", false)).toBeUndefined()
		expect(ended).toEqual([ADMINISTRATION_SESSION_END_REASON.IDLE])
		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION, details: { reason: ADMINISTRATION_SESSION_END_REASON.IDLE } },
		])
	})

	it("CAP-004-S08 ends a working session once the session length runs out", async () => {
		const { service, ended } = harnessWith(sessionRow({ last_activity_at: secondsAgo(1), expires_at: secondsAgo(1) }))
		expect(await service.resolve("token", false)).toBeUndefined()
		expect(ended).toEqual([ADMINISTRATION_SESSION_END_REASON.EXPIRED])
	})

	it("ends the session of a user whose administration access or account is gone on the server", async () => {
		const withoutAccess = harnessWith(sessionRow(), { permissions: [PERMISSION.USERS_MANAGE] })
		const inactive = harnessWith(sessionRow({ is_active: false }))
		expect(await withoutAccess.service.resolve("token", false)).toBeUndefined()
		expect(await inactive.service.resolve("token", false)).toBeUndefined()
		expect([...withoutAccess.ended, ...inactive.ended]).toEqual([
			ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED,
			ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED,
		])
	})

	it("refuses a session that has already ended", async () => {
		const { service, ended } = harnessWith(sessionRow({ ended_at: secondsAgo(5) }))
		expect(await service.resolve("token", false)).toBeUndefined()
		expect(ended).toEqual([])
	})

	it("asks the identity provider again only once the token validity has passed", async () => {
		const fresh = harnessWith(sessionRow())
		await fresh.service.resolve("token", false)
		expect(fresh.asked).toEqual([])

		const due = harnessWith(sessionRow({ confirmed_at: secondsAgo(TOKEN_VALIDITY_SECONDS) }))
		expect(await due.service.resolve("token", false)).toEqual(RESOLVED)
		expect(due.asked).toEqual([USER_ID])
		expect(due.confirmed).toEqual([SESSION_ID])
	})

	it("CAP-004-S05 ends the session once the identity provider no longer accepts the account", async () => {
		const { service, ended } = harnessWith(sessionRow({ confirmed_at: secondsAgo(TOKEN_VALIDITY_SECONDS) }), {
			providerFailure: IDENTITY_PROVIDER_FAILURE.REJECTED,
		})
		expect(await service.resolve("token", false)).toBeUndefined()
		expect(ended).toEqual([ADMINISTRATION_SESSION_END_REASON.PROVIDER_REJECTED])
	})

	it("keeps the session and asks for a retry while the identity provider is down", async () => {
		const { service, ended } = harnessWith(sessionRow({ confirmed_at: secondsAgo(TOKEN_VALIDITY_SECONDS) }), {
			providerFailure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE,
		})
		const error = await service.resolve("token", false).catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(ProblemException)
		expect((error as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.RETRY)
		expect(ended).toEqual([])
	})

	it("CAP-002-R10 ends every open session of a revoked user and records each end", async () => {
		const { service, ended, audited } = harnessWith(sessionRow())

		await service.endAllOf({} as never, USER_ID, ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED, new Date())

		expect(ended).toEqual([ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED])
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
				actorUserId: USER_ID,
				sessionId: SESSION_ID,
				details: { scope: "administration", reason: ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED },
			}),
		])
	})
})
