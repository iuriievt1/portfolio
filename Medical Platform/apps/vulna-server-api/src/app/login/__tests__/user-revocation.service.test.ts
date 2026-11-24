import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, PERMISSIONS, SESSION_END_REASON, type SessionEndReason } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import {
	ADMINISTRATION_SESSION_END_REASON,
	type AdministrationSessionEndReason,
} from "../../administration-session/constants/administration-session.constants"
import type { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { CarrierRevocationService } from "../services/carrier-revocation.service"
import type { SessionService } from "../services/session.service"
import { UserRevocationService } from "../services/user-revocation.service"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "99999999-9999-4999-8999-999999999999",
	userId: "11111111-1111-4111-8111-111111111111",
	permissions: PERMISSIONS,
}
const USER_ID = "22222222-2222-4222-8222-222222222222"
const UNKNOWN_USER_ID = "44444444-4444-4444-8444-444444444444"

interface Ended<Reason> {
	userId: string
	reason: Reason
}

interface Harness {
	service: UserRevocationService
	audited: NewAuditEvent[]
	carriersRevokedOf: string[]
	mobileEnded: Ended<SessionEndReason>[]
	administrationEnded: Ended<AdministrationSessionEndReason>[]
	isActive: () => boolean
}

function harness(active: boolean): Harness {
	let isActive = active
	const audited: NewAuditEvent[] = []
	const carriersRevokedOf: string[] = []
	const mobileEnded: Ended<SessionEndReason>[] = []
	const administrationEnded: Ended<AdministrationSessionEndReason>[] = []
	const users = {
		findById: async (id: string) => (id === USER_ID ? { id: USER_ID, isActive } : undefined),
		deactivate: async () => {
			const changed = isActive
			isActive = false
			return changed
		},
	} as unknown as AppUserRepository
	const carriers = {
		revokeAllOf: async (_sql: unknown, userId: string) => {
			carriersRevokedOf.push(userId)
		},
	} as unknown as CarrierRevocationService
	const sessions = {
		endAllOf: async (_sql: unknown, userId: string, reason: SessionEndReason) => {
			mobileEnded.push({ userId, reason })
		},
	} as unknown as SessionService
	const administrationSessions = {
		endAllOf: async (_sql: unknown, userId: string, reason: AdministrationSessionEndReason) => {
			administrationEnded.push({ userId, reason })
		},
	} as unknown as AdministrationSessionService
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: unknown, event: NewAuditEvent) => {
			audited.push(event)
		},
	} as unknown as AuditRepository
	return {
		service: new UserRevocationService(database, users, carriers, sessions, administrationSessions, audit),
		audited,
		carriersRevokedOf,
		mobileEnded,
		administrationEnded,
		isActive: () => isActive,
	}
}

describe("revocation of a user by the administrator", () => {
	it("CAP-005-S08 revokes the account, its carriers and every session at once", async () => {
		const { service, audited, carriersRevokedOf, mobileEnded, administrationEnded, isActive } = harness(true)

		await service.revoke(USER_ID, ADMINISTRATOR)

		expect(isActive()).toBe(false)
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.USER_REVOCATION,
				actorUserId: ADMINISTRATOR.userId,
				objectId: USER_ID,
			}),
		])
		expect(carriersRevokedOf).toEqual([USER_ID])
		expect(mobileEnded).toEqual([{ userId: USER_ID, reason: SESSION_END_REASON.USER_REVOKED }])
		expect(administrationEnded).toEqual([{ userId: USER_ID, reason: ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED }])
	})

	it("changes and records nothing when the user is already revoked", async () => {
		const { service, audited, carriersRevokedOf, mobileEnded, administrationEnded } = harness(false)

		await service.revoke(USER_ID, ADMINISTRATOR)

		expect(audited).toEqual([])
		expect(carriersRevokedOf).toEqual([])
		expect(mobileEnded).toEqual([])
		expect(administrationEnded).toEqual([])
	})

	it("refuses an unknown user", async () => {
		const { service, audited } = harness(true)

		const refusal = await service.revoke(UNKNOWN_USER_ID, ADMINISTRATOR).catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(audited).toEqual([])
	})
})
