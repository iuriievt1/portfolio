import { generateKeyPairSync } from "node:crypto"
import { ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	type PublicKeyJwk,
	ROLE,
	type Role,
	SESSION_END_REASON,
	SESSION_OUTCOME,
	sha256Hex,
} from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { Device } from "../../device/types/device.types"
import type { EffectiveConfigurationService } from "../../effective-configuration/services/effective-configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { SessionRepository } from "../repositories/session.repository"
import type { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import { SessionService } from "../services/session.service"
import type { UserIdentityService } from "../services/user-identity.service"
import type { AppUser, NewUserSession, UserSession } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"

const NOW = new Date("2026-09-30T10:00:00.000Z")
const USER_A = "11111111-1111-4111-8111-111111111111"
const USER_B = "22222222-2222-4222-8222-222222222222"
const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const TX = {} as postgres.TransactionSql

const POLICY: LoginPolicy = {
	version: 1,
	session: { sessionMaxSeconds: 8 * 3600, tokenValiditySeconds: 900 },
	idleLockSeconds: 300,
	fullLoginIntervalSeconds: 30 * 24 * 3600,
	pinAttemptsLimit: 5,
	pinDelaySeconds: 1,
	credentialAttemptsLimit: 5,
	cardIdentityMode: "uid_binding",
	cardBindingCodeLifetimeSeconds: 300,
	personalNumberClaim: "personal_number",
	loginNameClaim: undefined,
	emailClaim: undefined,
	groupClaim: undefined,
	authorizedGroup: undefined,
	departmentClaim: undefined,
	groupToRole: [],
	administration: { idleLogoutSeconds: 30 * 60, sessionMaxSeconds: 8 * 3600 },
}

function deviceKey(): PublicKeyJwk {
	const exported = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ format: "jwk" })
	return { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string }
}

const DEVICE: Device = {
	id: DEVICE_ID,
	state: "approved",
	hwId: "hw-1",
	publicKeyJwk: deviceKey(),
	groupCode: null,
	loginMethods: {},
}
const USER: AppUser = {
	id: USER_A,
	personalNumber: "000101",
	displayName: "Jana Nováková",
	isActive: true,
	loginName: null,
	email: null,
	preferredLanguage: null,
}

interface Harness {
	service: SessionService
	sessions: UserSession[]
	audited: NewAuditEvent[]
	rotated: { id: string; tokenHash: string }[]
}

function harness(
	active: UserSession | undefined,
	roles: Role[] = [ROLE.CLINICIAN],
	revokedUserIds: readonly string[] = [],
): Harness {
	const sessions: UserSession[] = active === undefined ? [] : [active]
	const audited: NewAuditEvent[] = []
	const rotated: Harness["rotated"] = []
	const repository = {
		activeOnDevice: async () => sessions.find((session) => session.endedAt === null),
		activeOfUser: async (_sql: unknown, userId: string) =>
			sessions.filter((session) => session.userId === userId && session.endedAt === null),
		insert: async (_sql: unknown, next: NewUserSession) => {
			const session: UserSession = {
				id: `session-${sessions.length + 1}`,
				userId: next.userId,
				deviceId: next.deviceId,
				tokenExpiresAt: next.tokenExpiresAt,
				startedAt: next.startedAt,
				sessionEnd: next.sessionEnd,
				endedAt: null,
			}
			sessions.push(session)
			return session
		},
		rotateToken: async (_sql: unknown, id: string, hash: string) => {
			rotated.push({ id, tokenHash: hash })
		},
		end: async (_sql: unknown, id: string, _reason: string, now: Date) => {
			const session = sessions.find((candidate) => candidate.id === id)
			if (session !== undefined) {
				session.endedAt = now
			}
		},
		findByTokenHash: async () => undefined,
	} as unknown as SessionRepository
	const users = {
		lockActive: async (_sql: unknown, userId: string) => !revokedUserIds.includes(userId),
	} as unknown as AppUserRepository
	const audit = {
		append: async (_tx: unknown, event: NewAuditEvent) => audited.push(event),
	} as unknown as AuditRepository
	const credentials = {
		find: async () => ({ pinPublicKey: null, blockedAt: null, lastFullLoginAt: NOW }),
	} as unknown as UserDeviceCredentialRepository
	const identities = { rolesOf: async () => roles } as unknown as UserIdentityService
	const configuration = {
		forDevice: async () => ({ version: 1, allowed_login_methods: ["oidc", "pin"] }),
	} as unknown as EffectiveConfigurationService
	return {
		service: new SessionService(repository, users, credentials, identities, audit, configuration),
		sessions,
		audited,
		rotated,
	}
}

function activeSessionOf(userId: string): UserSession {
	const startedAt = new Date(NOW.getTime() - 3_600_000)
	return {
		id: "session-1",
		userId,
		deviceId: DEVICE_ID,
		tokenExpiresAt: new Date(NOW.getTime() - 60_000),
		startedAt,
		sessionEnd: new Date(startedAt.getTime() + 8 * 3_600_000),
		endedAt: null,
	}
}

describe("one user session per device", () => {
	it("CAP-002-S05 CAP-002-S17 resumes the session of its owner with a new token and the same end", async () => {
		const active = activeSessionOf(USER_A)
		const { service, rotated, sessions } = harness(active)
		const issued = await service.issueOrResume(TX, USER_A, DEVICE_ID, POLICY, NOW)
		expect(issued.outcome).toBe(SESSION_OUTCOME.RESUMED)
		expect(issued.session.id).toBe("session-1")
		expect(issued.session.sessionEnd).toEqual(active.sessionEnd)
		expect(issued.session.tokenExpiresAt.toISOString()).toBe("2026-09-30T10:15:00.000Z")
		expect(rotated).toEqual([{ id: "session-1", tokenHash: sha256Hex(issued.token) }])
		expect(sessions).toHaveLength(1)
	})

	it("CAP-002-S18 ends the session of the previous user when another one signs in", async () => {
		const { service, sessions, audited } = harness(activeSessionOf(USER_A))
		const issued = await service.issueOrResume(TX, USER_B, DEVICE_ID, POLICY, NOW)
		expect(issued.outcome).toBe(SESSION_OUTCOME.CREATED)
		expect(sessions[0]?.endedAt).toEqual(NOW)
		expect(sessions[1]).toMatchObject({ userId: USER_B, startedAt: NOW })
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
				details: { scope: "mobile", reason: SESSION_END_REASON.REPLACED },
			}),
		])
	})

	it("creates a session eight hours long when the device has none", async () => {
		const { service } = harness(undefined)
		const issued = await service.issueOrResume(TX, USER_A, DEVICE_ID, POLICY, NOW)
		expect(issued.outcome).toBe(SESSION_OUTCOME.CREATED)
		expect(issued.session.sessionEnd.toISOString()).toBe("2026-09-30T18:00:00.000Z")
		expect(issued.token.length).toBeGreaterThan(32)
	})

	it("answers with the session, the user, the roles and the effective configuration", async () => {
		const { service } = harness(undefined)
		const issued = await service.issueOrResume(TX, USER_A, DEVICE_ID, POLICY, NOW)
		const response = await service.respond(TX, issued, USER, DEVICE, POLICY)
		expect(response).toMatchObject({
			session_id: issued.session.id,
			session_outcome: "created",
			session_token: issued.token,
			inactivity_lock_seconds: 300,
			full_login_until: "2026-10-30T10:00:00.000Z",
			user: {
				id: USER_A,
				personal_number: "000101",
				display_name: "Jana Nováková",
				roles: ["clinician"],
				preferred_language: null,
			},
			effective_configuration: { version: 1, allowed_login_methods: ["oidc", "pin"] },
		})
	})

	it("CAP-003-S04 issues the session of a user without any role with an empty role list", async () => {
		const { service } = harness(undefined, [])
		const issued = await service.issueOrResume(TX, USER_A, DEVICE_ID, POLICY, NOW)
		const response = await service.respond(TX, issued, USER, DEVICE, POLICY)
		expect(response.user.roles).toEqual([])
	})

	it("CAP-002-R08 issues no session to a user revoked while the login was under way", async () => {
		const { service, sessions } = harness(undefined, [ROLE.CLINICIAN], [USER_A])

		const refusal = await service.issueOrResume(TX, USER_A, DEVICE_ID, POLICY, NOW).catch((error: unknown) => error)

		expect(refusal).toBeInstanceOf(ProblemException)
		expect((refusal as ProblemException).code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
		expect(sessions).toEqual([])
	})
})

describe("sessions of a revoked user", () => {
	it("CAP-002-R10 ends every open session of the user and records each end", async () => {
		const { service, sessions, audited } = harness(activeSessionOf(USER_A))

		await service.endAllOf(TX, USER_A, SESSION_END_REASON.USER_REVOKED, NOW)

		expect(sessions[0]?.endedAt).toEqual(NOW)
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
				sessionId: "session-1",
				details: { scope: "mobile", reason: SESSION_END_REASON.USER_REVOKED },
			}),
		])
	})

	it("leaves the sessions of other users open", async () => {
		const { service, sessions, audited } = harness(activeSessionOf(USER_B))

		await service.endAllOf(TX, USER_A, SESSION_END_REASON.USER_REVOKED, NOW)

		expect(sessions[0]?.endedAt).toBeNull()
		expect(audited).toEqual([])
	})
})
