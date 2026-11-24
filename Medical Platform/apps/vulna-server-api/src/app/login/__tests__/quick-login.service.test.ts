import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto"
import { ERROR_CODE, RETRY_AFTER_HEADER } from "@ansora/contracts"
import {
	hardwareId,
	IDENTITY_PROVIDER_FAILURE,
	LOGIN_METHOD,
	type LoginMethod,
	MILLISECONDS_PER_SECOND,
	type PinPublicKeyJwk,
	type PublicKeyJwk,
	SESSION_END_REASON,
	type UserDeviceCredential,
} from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { QrCodeKeyService } from "../../../libs/qr-code/qr-code-key.service"
import type { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import type { EffectiveConfigurationService } from "../../effective-configuration/services/effective-configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { LOGIN_FAILURE_DETAIL, OUTSIDE_AUTHORIZED_GROUP } from "../constants/login-failure.constants"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { CardRepository } from "../repositories/card.repository"
import type { SessionRepository } from "../repositories/session.repository"
import type { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import type { CardIdentityService } from "../services/card-identity.service"
import type { LoginAttemptService } from "../services/login-attempt.service"
import type { LoginChallengeService } from "../services/login-challenge.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import { QuickLoginService } from "../services/quick-login.service"
import type { SessionService } from "../services/session.service"
import type { UserIdentityService } from "../services/user-identity.service"
import type { AppUser, AttemptRecord, FailureState, UserSession } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const PERSONAL_NUMBER = "000101"
const CHALLENGE_ID = "44444444-4444-4444-8444-444444444444"
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555"
const CARD_IDENTIFIER = "04A1B2C3"
const QR_CODE_CONTENT = "VULNA1.1.QRIDENTIFIER.SIGNATURE"
const BARCODE_CONTENT = "PSVOBODA"
const ALL_METHODS: LoginMethod[] = Object.values(LOGIN_METHOD)

interface TestKey {
	privateKey: KeyObject
	jwk: PublicKeyJwk
}

function ecKey(): TestKey {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string } }
}

const DEVICE_KEY = ecKey()
const PIN_KEY = ecKey()
const DEVICE: Device = {
	id: DEVICE_ID,
	state: "approved",
	hwId: hardwareId(DEVICE_KEY.jwk),
	publicKeyJwk: DEVICE_KEY.jwk,
	groupCode: null,
	loginMethods: {},
}
const USER: AppUser = {
	id: USER_ID,
	personalNumber: PERSONAL_NUMBER,
	displayName: "Jana Nováková",
	isActive: true,
	loginName: null,
	email: null,
	preferredLanguage: null,
}

const OTHER_USER: AppUser = { ...USER, id: OTHER_USER_ID, personalNumber: "000202", displayName: "Petr Svoboda" }

const POLICY: LoginPolicy = {
	version: 1,
	session: { sessionMaxSeconds: 8 * 3600, tokenValiditySeconds: 900 },
	idleLockSeconds: 300,
	fullLoginIntervalSeconds: 30 * 24 * 3600,
	pinAttemptsLimit: 3,
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

function signedJws(key: TestKey, claims: Record<string, unknown>): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
	const payload = {
		challenge_id: CHALLENGE_ID,
		value: "nonce",
		iat: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
		...claims,
	}
	const input = `${encode({ alg: "ES256", typ: "JWT" })}.${encode(payload)}`
	const signature = createSign("sha256").update(input).sign({ key: key.privateKey, dsaEncoding: "ieee-p1363" })
	return `${input}.${signature.toString("base64url")}`
}

function proofOf(key: TestKey): string {
	return signedJws(key, { personal_number: PERSONAL_NUMBER, jkt: hardwareId(DEVICE_KEY.jwk) })
}

function cardBodyOf(identifier: string): string {
	return signedJws(DEVICE_KEY, { identifier })
}

interface Harness {
	service: QuickLoginService
	attempts: AttemptRecord[]
	blocked: string[]
	ended: string[]
	issued: number
	providerConfirmations: number
	loginNames: string[]
}

interface HarnessOptions {
	credential: UserDeviceCredential | undefined
	failures: FailureState
	activeSession: UserSession | undefined
	challengeValid: boolean
	confirmedUserId: string | null
	providerOk: boolean
	providerFailure: string
	allowedMethods: LoginMethod[]
	carrierUserId: string | undefined
	deviceRejection: ProblemException | undefined
}

function harness(options: Partial<HarnessOptions> = {}): Harness {
	const settings: HarnessOptions = {
		credential: {
			pinPublicKey: PIN_KEY.jwk as PinPublicKeyJwk,
			blockedAt: null,
			lastFullLoginAt: new Date(),
		},
		failures: { consecutiveFailures: 0, lastFailedAt: undefined },
		activeSession: undefined,
		challengeValid: true,
		confirmedUserId: null,
		providerOk: true,
		providerFailure: IDENTITY_PROVIDER_FAILURE.REJECTED,
		allowedMethods: ALL_METHODS,
		carrierUserId: undefined,
		deviceRejection: undefined,
		...options,
	}
	const state: Harness = {
		service: undefined as unknown as QuickLoginService,
		attempts: [],
		blocked: [],
		ended: [],
		issued: 0,
		providerConfirmations: 0,
		loginNames: [],
	}
	const tx = {}
	const database = {
		sql: { begin: async (work: (tx: unknown) => Promise<unknown>) => await work(tx) },
	} as unknown as DatabaseService
	const proofs = {
		ofApprovedDevice: async () => {
			if (settings.deviceRejection !== undefined) {
				throw settings.deviceRejection
			}
			return DEVICE
		},
	} as unknown as DeviceProofService
	const policies = { current: async () => POLICY } as unknown as LoginPolicyService
	const configuration = {
		forDevice: async () => ({ allowed_login_methods: settings.allowedMethods }),
	} as unknown as EffectiveConfigurationService
	const challenges = {
		consume: async () => (settings.challengeValid ? { confirmedUserId: settings.confirmedUserId } : undefined),
	} as unknown as LoginChallengeService
	const carrier = () => (settings.carrierUserId === undefined ? undefined : { userId: settings.carrierUserId })
	const cardIdentity = { resolve: async () => carrier() } as unknown as CardIdentityService
	const qrKeys = { verify: () => settings.carrierUserId !== undefined } as unknown as QrCodeKeyService
	const cards = {
		findValidQrCode: async () =>
			settings.carrierUserId === undefined ? undefined : { user_id: settings.carrierUserId },
	} as unknown as CardRepository
	const users = {
		findByPersonalNumber: async (number: string) => (number === PERSONAL_NUMBER ? USER : undefined),
		findById: async (id: string) => [USER, OTHER_USER].find((user) => user.id === id),
		findByLoginName: async (loginName: string) => {
			state.loginNames.push(loginName)
			return [USER, OTHER_USER].find((user) => user.id === settings.carrierUserId)
		},
	} as unknown as AppUserRepository
	const credentials = {
		find: async () => settings.credential,
		block: async (_sql: unknown, userId: string) => {
			state.blocked.push(userId)
		},
	} as unknown as UserDeviceCredentialRepository
	const sessions = {
		issueOrResume: async () => {
			state.issued += 1
			return {
				session: { id: "session-1", tokenExpiresAt: new Date(), sessionEnd: new Date() },
				token: "token",
				outcome: "created",
			}
		},
		respond: async () => ({ session_id: "session-1", session_outcome: "created" }),
		end: async (_sql: unknown, session: UserSession, reason: string) => {
			state.ended.push(`${session.id}:${reason}`)
		},
	} as unknown as SessionService
	const sessionRows = { activeOnDevice: async () => settings.activeSession } as unknown as SessionRepository
	const identities = {
		confirmWithProvider: async () => {
			state.providerConfirmations += 1
			return settings.providerOk ? { ok: true } : { ok: false, failure: settings.providerFailure }
		},
	} as unknown as UserIdentityService
	const attempts = {
		record: async (_sql: unknown, attempt: AttemptRecord) => {
			state.attempts.push(attempt)
		},
		recordFailure: async (attempt: AttemptRecord) => {
			state.attempts.push(attempt)
		},
		failureState: async () => settings.failures,
	} as unknown as LoginAttemptService
	state.service = new QuickLoginService(
		database,
		proofs,
		policies,
		configuration,
		challenges,
		cardIdentity,
		qrKeys,
		cards,
		users,
		credentials,
		sessions,
		sessionRows,
		identities,
		attempts,
	)
	return state
}

async function rejectionOf(work: Promise<unknown>): Promise<ProblemException> {
	try {
		await work
	} catch (error) {
		if (error instanceof ProblemException) {
			return error
		}
		throw error
	}
	throw new Error("expected a rejection")
}

const REQUEST = {} as Request

describe("loginWithPin", () => {
	it("CAP-001-S04 issues a session for a proof of the pair key and records the attempt", async () => {
		const state = harness()
		const response = await state.service.loginWithPin(REQUEST, {
			personal_number: PERSONAL_NUMBER,
			proof: proofOf(PIN_KEY),
		})
		expect(response.session_id).toBe("session-1")
		expect(state.issued).toBe(1)
		expect(state.attempts).toEqual([expect.objectContaining({ userId: USER_ID, method: "pin", reason: undefined })])
	})

	it("CAP-001-S16 CAP-001-S26 counts a wrong or too short PIN and answers with a growing delay", async () => {
		const state = harness({ failures: { consecutiveFailures: 1, lastFailedAt: new Date(Date.now() - 5000) } })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(ecKey()) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(rejection.headers[RETRY_AFTER_HEADER]).toBe("2")
		expect(state.attempts).toEqual([expect.objectContaining({ userId: USER_ID, reason: ERROR_CODE.LOGIN_FAILED })])
		expect(state.blocked).toEqual([])
	})

	it("CAP-001-S07 CAP-002-S16 blocks the pair at the limit and ends the owner's session", async () => {
		const active = { id: "session-1", userId: USER_ID, deviceId: DEVICE_ID } as UserSession
		const state = harness({
			failures: { consecutiveFailures: 2, lastFailedAt: new Date(Date.now() - 60_000) },
			activeSession: active,
		})
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(ecKey()) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.ATTEMPTS_EXHAUSTED)
		expect(state.blocked).toEqual([USER_ID])
		expect(state.ended).toEqual([`session-1:${SESSION_END_REASON.ATTEMPTS_EXHAUSTED}`])
	})

	it("CAP-002-S19 blocks only the other user who ran out of PIN attempts and keeps the locked session", async () => {
		const locked = { id: "session-0", userId: OTHER_USER_ID, deviceId: DEVICE_ID } as UserSession
		const state = harness({
			failures: { consecutiveFailures: 2, lastFailedAt: new Date(Date.now() - 60_000) },
			activeSession: locked,
		})
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(ecKey()) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.ATTEMPTS_EXHAUSTED)
		expect(state.blocked).toEqual([USER_ID])
		expect(state.ended).toEqual([])
	})

	it("refuses an attempt inside the delay without evaluating the proof", async () => {
		const state = harness({ failures: { consecutiveFailures: 3, lastFailedAt: new Date() } })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(rejection.headers[RETRY_AFTER_HEADER]).toBe("4")
		expect(state.issued).toBe(0)
	})

	it("CAP-001-S31 requires a full sign-in on a device without one, before the proof is checked", async () => {
		const state = harness({ credential: undefined })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.FULL_LOGIN_REQUIRED)
		expect(rejection.getStatus()).toBe(403)
	})

	it("CAP-001-S15 answers challenge-invalid for a consumed challenge and counts nothing", async () => {
		const state = harness({ challengeValid: false })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.CHALLENGE_INVALID)
		expect(state.attempts).toEqual([expect.objectContaining({ userId: null, reason: ERROR_CODE.CHALLENGE_INVALID })])
	})

	it("CAP-001-R07 refuses the login when the provider no longer confirms the identity", async () => {
		const state = harness({ providerOk: false })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
		expect(state.issued).toBe(0)
	})

	it("CAP-001-R07 relies on the provider confirmation made for the same user when the challenge was issued", async () => {
		const state = harness({ confirmedUserId: USER_ID, providerOk: false })
		const response = await state.service.loginWithPin(REQUEST, {
			personal_number: PERSONAL_NUMBER,
			proof: proofOf(PIN_KEY),
		})
		expect(response.session_id).toBe("session-1")
		expect(state.providerConfirmations).toBe(0)
	})

	it("CAP-001-R07 asks the provider again when the challenge was confirmed for another user", async () => {
		const state = harness({ confirmedUserId: OTHER_USER_ID, providerOk: false })
		const rejection = await rejectionOf(
			state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) }),
		)
		expect(rejection.code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
		expect(state.providerConfirmations).toBe(1)
	})
})

describe("loginWithCard", () => {
	it("CAP-005-S14 counts an unknown carrier against the owner of the active session", async () => {
		const active = { id: "session-1", userId: USER_ID, deviceId: DEVICE_ID } as UserSession
		const state = harness({ activeSession: active, failures: { consecutiveFailures: 0, lastFailedAt: undefined } })
		const rejection = await rejectionOf(state.service.loginWithCard(REQUEST, cardBodyOf("04A1")))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.attempts).toEqual([
			expect.objectContaining({ userId: USER_ID, method: "card", reason: ERROR_CODE.LOGIN_FAILED }),
		])
	})

	it("CAP-002-R16 counts a barcode of nobody against the owner of the locked session", async () => {
		const locked = { id: "session-1", userId: USER_ID, deviceId: DEVICE_ID } as UserSession
		const state = harness({ activeSession: locked, failures: { consecutiveFailures: 0, lastFailedAt: undefined } })
		const rejection = await rejectionOf(state.service.loginWithBarcode(REQUEST, cardBodyOf(BARCODE_CONTENT)))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.attempts).toEqual([
			expect.objectContaining({ userId: USER_ID, method: LOGIN_METHOD.BARCODE, reason: ERROR_CODE.LOGIN_FAILED }),
		])
	})

	it("CAP-001-S06 refuses a replayed card login whose challenge is consumed", async () => {
		const state = harness({ challengeValid: false })
		const rejection = await rejectionOf(state.service.loginWithCard(REQUEST, cardBodyOf("04A1")))
		expect(rejection.code).toBe(ERROR_CODE.CHALLENGE_INVALID)
		expect(state.issued).toBe(0)
	})
})

function tamperedIdentifier(body: string, identifier: string): string {
	const [header, payload, signature] = body.split(".") as [string, string, string]
	const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
	const swapped = Buffer.from(JSON.stringify({ ...claims, identifier })).toString("base64url")
	return [header, swapped, signature].join(".")
}

function signInWith(state: Harness, method: LoginMethod): Promise<unknown> {
	switch (method) {
		case LOGIN_METHOD.PIN:
			return state.service.loginWithPin(REQUEST, { personal_number: PERSONAL_NUMBER, proof: proofOf(PIN_KEY) })
		case LOGIN_METHOD.CARD:
			return state.service.loginWithCard(REQUEST, cardBodyOf(CARD_IDENTIFIER))
		case LOGIN_METHOD.QR:
			return state.service.loginWithQrCode(REQUEST, cardBodyOf(QR_CODE_CONTENT))
		case LOGIN_METHOD.BARCODE:
			return state.service.loginWithBarcode(REQUEST, cardBodyOf(BARCODE_CONTENT))
		default:
			throw new Error(`${method} is not a quick method`)
	}
}

const QUICK_METHODS = [LOGIN_METHOD.PIN, LOGIN_METHOD.CARD, LOGIN_METHOD.QR, LOGIN_METHOD.BARCODE]

describe("every quick method", () => {
	it.each(QUICK_METHODS)(
		"CAP-001-S05 refuses %s for an account the directory blocked and records it",
		async (method) => {
			const state = harness({ providerOk: false, carrierUserId: USER_ID })
			const rejection = await rejectionOf(signInWith(state, method))
			expect(rejection.code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
			expect(state.issued).toBe(0)
			expect(state.attempts).toEqual([
				expect.objectContaining({ userId: USER_ID, reason: ERROR_CODE.ACCOUNT_INACTIVE }),
			])
		},
	)

	it.each(QUICK_METHODS)(
		"CAP-003-S09 refuses %s outside the authorized group, whatever role was assigned by hand",
		async (method) => {
			const state = harness({ providerOk: false, providerFailure: OUTSIDE_AUTHORIZED_GROUP, carrierUserId: USER_ID })
			const rejection = await rejectionOf(signInWith(state, method))
			expect(rejection.code).toBe(ERROR_CODE.ACCOUNT_INACTIVE)
			expect(state.issued).toBe(0)
			expect(state.attempts).toEqual([
				expect.objectContaining({
					reason: ERROR_CODE.ACCOUNT_INACTIVE,
					details: { detail: LOGIN_FAILURE_DETAIL.OUTSIDE_AUTHORIZED_GROUP },
				}),
			])
		},
	)

	it.each([ERROR_CODE.DEVICE_UNKNOWN, ERROR_CODE.DEVICE_PENDING_APPROVAL, ERROR_CODE.DEVICE_REVOKED])(
		"CAP-001-S08 refuses every method from a device the server answers %s for and issues no token",
		async (code) => {
			for (const method of QUICK_METHODS) {
				const state = harness({ carrierUserId: USER_ID, deviceRejection: new ProblemException(403, code) })
				expect((await rejectionOf(signInWith(state, method))).code).toBe(code)
				expect(state.issued).toBe(0)
			}
		},
	)

	it.each(QUICK_METHODS)(
		"CAP-001-S09 refuses %s turned off for the device even when the app sends it",
		async (method) => {
			const state = harness({
				carrierUserId: USER_ID,
				allowedMethods: ALL_METHODS.filter((allowed) => allowed !== method),
			})
			const rejection = await rejectionOf(signInWith(state, method))
			expect(rejection.code).toBe(ERROR_CODE.METHOD_DISABLED)
			expect(state.issued).toBe(0)
		},
	)
})

describe("carrier login", () => {
	it("CAP-001-S12 refuses a body whose identifier was swapped under a valid device proof", async () => {
		const state = harness({ carrierUserId: OTHER_USER_ID })
		const body = tamperedIdentifier(cardBodyOf(CARD_IDENTIFIER), "FOREIGN0")
		const rejection = await rejectionOf(state.service.loginWithCard(REQUEST, body))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.issued).toBe(0)
		expect(state.attempts).toEqual([expect.objectContaining({ userId: null, reason: ERROR_CODE.LOGIN_FAILED })])
	})

	it("CAP-005-S15 refuses a card the server does not resolve and records the attempt", async () => {
		const state = harness({ carrierUserId: undefined })
		const rejection = await rejectionOf(state.service.loginWithCard(REQUEST, cardBodyOf(CARD_IDENTIFIER)))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.issued).toBe(0)
		expect(state.attempts).toEqual([
			expect.objectContaining({ method: LOGIN_METHOD.CARD, reason: ERROR_CODE.LOGIN_FAILED }),
		])
	})

	it("signs in the user whose login name the employee card barcode carries, whatever the spaces around it", async () => {
		const state = harness({ carrierUserId: OTHER_USER_ID })
		await state.service.loginWithBarcode(REQUEST, cardBodyOf(` ${BARCODE_CONTENT} `))
		expect(state.loginNames).toEqual([BARCODE_CONTENT])
		expect(state.issued).toBe(1)
		expect(state.attempts).toEqual([
			expect.objectContaining({ userId: OTHER_USER_ID, method: LOGIN_METHOD.BARCODE, reason: undefined }),
		])
	})

	it("refuses a barcode of nobody like an unknown card and records the attempt", async () => {
		const state = harness({ carrierUserId: undefined })
		const rejection = await rejectionOf(state.service.loginWithBarcode(REQUEST, cardBodyOf(BARCODE_CONTENT)))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.issued).toBe(0)
		expect(state.attempts).toEqual([
			expect.objectContaining({
				method: LOGIN_METHOD.BARCODE,
				reason: ERROR_CODE.LOGIN_FAILED,
				details: { detail: LOGIN_FAILURE_DETAIL.UNKNOWN_CARRIER },
			}),
		])
	})

	it("looks nobody up for a blank barcode", async () => {
		const state = harness({ carrierUserId: USER_ID })
		const rejection = await rejectionOf(state.service.loginWithBarcode(REQUEST, cardBodyOf("   ")))
		expect(rejection.code).toBe(ERROR_CODE.LOGIN_FAILED)
		expect(state.loginNames).toEqual([])
		expect(state.issued).toBe(0)
	})

	it("CAP-001-S30 signs in the owner of the QR code, not the account shown on the screen", async () => {
		const locked = { id: "session-0", userId: USER_ID, deviceId: DEVICE_ID } as UserSession
		const state = harness({ carrierUserId: OTHER_USER_ID, activeSession: locked })
		await state.service.loginWithQrCode(REQUEST, cardBodyOf(QR_CODE_CONTENT))
		expect(state.issued).toBe(1)
		expect(state.attempts).toEqual([
			expect.objectContaining({ userId: OTHER_USER_ID, method: LOGIN_METHOD.QR, reason: undefined }),
		])
	})
})
