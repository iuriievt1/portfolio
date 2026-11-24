import { ERROR_CODE } from "@ansora/contracts"
import { type AuthenticatedIdentity, type IdentityProviderPort, MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { LoginChallengeRepository } from "../repositories/login-challenge.repository"
import type { LoginFlowRepository } from "../repositories/login-flow.repository"
import type { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import type { LoginAttemptService } from "../services/login-attempt.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import { OidcLoginService } from "../services/oidc-login.service"
import type { SessionService } from "../services/session.service"
import type { UserIdentityService } from "../services/user-identity.service"
import type { AttemptRecord, LoginFlowReturn, LoginFlowRow } from "../types/login.types"

const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const DEVICE = { id: DEVICE_ID, hwId: "hw-1" } as Device
const STATE = "flow-state"
const MINUTE = 60_000

function identityWithoutPersonalNumber(): AuthenticatedIdentity {
	return {
		subjectId: "subject-e",
		displayName: "Eva Dvořáková",
		givenName: "Eva",
		familyName: "Dvořáková",
		authTime: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
		claims: { sub: "subject-e" },
		refreshToken: undefined,
	}
}

interface Harness {
	service: OidcLoginService
	flow: LoginFlowRow
	attempts: AttemptRecord[]
	sessions: number
	credentials: number
}

function identityOutsideTheGroup(): AuthenticatedIdentity {
	return {
		...identityWithoutPersonalNumber(),
		claims: { sub: "subject-e", personal_number: "000101", groups: ["vulna-clinicians"] },
	}
}

const POLICY_WITH_GROUPS = {
	personalNumberClaim: "personal_number",
	groupClaim: "groups",
	authorizedGroup: "vulna-users",
}

function harness(
	identity: AuthenticatedIdentity = identityWithoutPersonalNumber(),
	policy: object = { personalNumberClaim: "personal_number" },
): Harness {
	const now = new Date()
	const state: Harness = {
		service: undefined as unknown as OidcLoginService,
		flow: {
			state: STATE,
			device_id: DEVICE_ID,
			device_key_thumbprint: DEVICE.hwId,
			code_verifier: "verifier",
			nonce: "nonce",
			expected_personal_number: null,
			started_at: new Date(now.getTime() - MINUTE),
			expires_at: new Date(now.getTime() + MINUTE),
			returned_at: null,
			outcome: null,
			completion_code_hash: null,
			completion_expires_at: null,
			consumed_at: null,
		},
		attempts: [],
		sessions: 0,
		credentials: 0,
	}
	const flows = {
		findByState: async () => state.flow,
		recordReturn: async (_state: string, flowReturn: LoginFlowReturn) => {
			state.flow = {
				...state.flow,
				returned_at: flowReturn.returnedAt,
				outcome: flowReturn.outcome,
				completion_code_hash: flowReturn.completionCodeHash,
				completion_expires_at: flowReturn.completionExpiresAt,
			}
			return true
		},
		consume: async () => true,
	} as unknown as LoginFlowRepository
	const provider = {
		issuer: () => "https://idp.example",
		exchangeCode: async () => ({ ok: true, identity }),
	} as unknown as IdentityProviderPort
	const policies = {
		current: async () => policy,
	} as unknown as LoginPolicyService
	const attempts = {
		recordFailure: async (attempt: AttemptRecord) => {
			state.attempts.push(attempt)
		},
	} as unknown as LoginAttemptService
	const sessions = {
		issueOrResume: async () => {
			state.sessions += 1
		},
	} as unknown as SessionService
	const credentials = {
		find: async () => undefined,
		recordFullLogin: async () => {
			state.credentials += 1
		},
	} as unknown as UserDeviceCredentialRepository
	state.service = new OidcLoginService(
		{
			sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
		} as unknown as DatabaseService,
		{ ofApprovedDevice: async () => DEVICE } as unknown as DeviceProofService,
		flows,
		{} as LoginChallengeRepository,
		{ findIdentity: async () => undefined } as unknown as AppUserRepository,
		credentials,
		{} as UserIdentityService,
		sessions,
		attempts,
		policies,
		provider,
	)
	return state
}

describe("OidcLoginService", () => {
	it("CAP-001-S22 refuses an ID token without the configured personal number claim and records it", async () => {
		const state = harness()
		const appUrl = await state.service.processReturn({
			state: STATE,
			code: "code",
			error: undefined,
			errorDescription: undefined,
		})
		expect(state.flow.outcome).toEqual({ ok: false, code: ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING })
		expect(state.attempts).toEqual([
			expect.objectContaining({ deviceId: DEVICE_ID, reason: ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING }),
		])

		const completionCode = new URL(appUrl).searchParams.get("completion_code") ?? ""
		const error: unknown = await state.service
			.complete({} as Request, { state: STATE, completion_code: completionCode })
			.catch((caught: unknown) => caught)
		expect(error instanceof ProblemException && error.code).toBe(ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING)
		expect(state.sessions).toBe(0)
		expect(state.credentials).toBe(0)
	})

	it("CAP-003-S09 refuses a full login outside the authorized group and records it", async () => {
		const state = harness(identityOutsideTheGroup(), POLICY_WITH_GROUPS)
		const appUrl = await state.service.processReturn({
			state: STATE,
			code: "code",
			error: undefined,
			errorDescription: undefined,
		})
		expect(state.flow.outcome).toEqual({ ok: false, code: ERROR_CODE.ACCOUNT_INACTIVE })
		expect(state.attempts).toEqual([expect.objectContaining({ reason: ERROR_CODE.ACCOUNT_INACTIVE })])

		const completionCode = new URL(appUrl).searchParams.get("completion_code") ?? ""
		const error: unknown = await state.service
			.complete({} as Request, { state: STATE, completion_code: completionCode })
			.catch((caught: unknown) => caught)
		expect(error instanceof ProblemException && error.code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
		expect(state.sessions).toBe(0)
	})
})
