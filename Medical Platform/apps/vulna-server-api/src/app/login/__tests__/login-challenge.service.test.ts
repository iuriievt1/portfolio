import { IDENTITY_PROVIDER_FAILURE, type IssuedChallenge, sha256Hex } from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { DeviceProofService } from "../../device/services/device-proof.service"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { LoginChallengeRepository } from "../repositories/login-challenge.repository"
import type { SessionRepository } from "../repositories/session.repository"
import { LoginChallengeService } from "../services/login-challenge.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import type { UserIdentityService } from "../services/user-identity.service"
import type { AppUser, LoginChallengeRow, UserSession } from "../types/login.types"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const CHALLENGE_ID = "44444444-4444-4444-8444-444444444444"
const VALUE = "challenge-value"
const NOW = new Date("2026-10-08T10:00:00.000Z")
const USER: AppUser = {
	id: USER_ID,
	personalNumber: "000101",
	displayName: "Jana Nováková",
	isActive: true,
	loginName: null,
	email: null,
	preferredLanguage: null,
}
const SESSION = { id: "session-1", userId: USER_ID, deviceId: DEVICE_ID } as UserSession

interface Setup {
	session: UserSession | undefined
	user: AppUser | undefined
	providerOk: boolean
	stored: LoginChallengeRow | undefined
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = { session: SESSION, user: USER, providerOk: true, stored: undefined, ...setup }
	const inserted: { challenge: IssuedChallenge; confirmedUserId: string | null }[] = []
	const moments: Date[] = []
	let confirmations = 0
	const database = { sql: {} } as unknown as DatabaseService
	const proofs = { ofApprovedDevice: async () => ({ id: DEVICE_ID }) } as unknown as DeviceProofService
	const challenges = {
		deleteExpired: async (now: Date) => {
			moments.push(now)
		},
		insert: async (_deviceId: string, challenge: IssuedChallenge, confirmedUserId: string | null) => {
			inserted.push({ challenge, confirmedUserId })
		},
		consume: async () => state.stored,
	} as unknown as LoginChallengeRepository
	const sessions = {
		activeOnDevice: async (_sql: never, _deviceId: string, now: Date) => {
			moments.push(now)
			return state.session
		},
	} as unknown as SessionRepository
	const users = { findById: async () => state.user } as unknown as AppUserRepository
	const policies = { current: async () => ({}) } as unknown as LoginPolicyService
	const identities = {
		confirmWithProvider: async (_user: AppUser, _policy: never, now: Date) => {
			moments.push(now)
			confirmations += 1
			return state.providerOk ? { ok: true } : { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED }
		},
	} as unknown as UserIdentityService
	const service = new LoginChallengeService(database, proofs, challenges, sessions, users, policies, identities)
	return { service, inserted, moments, confirmations: () => confirmations }
}

const REQUEST = {} as Request

describe("challenge issued with the provider asked ahead CAP-001-R07", () => {
	it("CAP-002-R03 confirms the owner of the device's session with the provider and keeps it with the challenge", async () => {
		const run = harness()

		await run.service.issue(REQUEST)

		expect(run.confirmations()).toBe(1)
		expect(run.inserted.map((row) => row.confirmedUserId)).toEqual([USER_ID])
	})

	it("asks nobody when no session runs on the device", async () => {
		const run = harness({ session: undefined })

		await run.service.issue(REQUEST)

		expect(run.confirmations()).toBe(0)
		expect(run.inserted.map((row) => row.confirmedUserId)).toEqual([null])
	})

	it("asks nobody for an inactive user", async () => {
		const run = harness({ user: { ...USER, isActive: false } })

		await run.service.issue(REQUEST)

		expect(run.confirmations()).toBe(0)
		expect(run.inserted.map((row) => row.confirmedUserId)).toEqual([null])
	})

	it("issues the challenge without a confirmation when the provider refuses, so the login asks again", async () => {
		const run = harness({ providerOk: false })

		const challenge = await run.service.issue(REQUEST)

		expect(challenge.challenge_id).toBe(run.inserted[0]?.challenge.id)
		expect(run.inserted.map((row) => row.confirmedUserId)).toEqual([null])
	})

	it("CAP-002-R03 asks the provider and keeps the challenge at one and the same moment", async () => {
		const run = harness()

		await run.service.issue(REQUEST)

		expect(run.moments).toHaveLength(3)
		expect(new Set(run.moments).size).toBe(1)
	})

	it("hands the confirmed user over with the consumed challenge", async () => {
		const run = harness({ stored: { value_hash: sha256Hex(VALUE), confirmed_user_id: USER_ID } })

		const consumed = await run.service.consume(CHALLENGE_ID, DEVICE_ID, VALUE, NOW)

		expect(consumed).toEqual({ confirmedUserId: USER_ID })
	})

	it("CAP-001-R24 refuses a challenge answered with another value", async () => {
		const run = harness({ stored: { value_hash: sha256Hex(VALUE), confirmed_user_id: USER_ID } })

		const consumed = await run.service.consume(CHALLENGE_ID, DEVICE_ID, "other-value", NOW)

		expect(consumed).toBeUndefined()
	})
})
