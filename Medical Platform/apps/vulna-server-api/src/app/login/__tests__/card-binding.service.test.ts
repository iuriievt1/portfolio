import { createSign, generateKeyPairSync } from "node:crypto"
import { ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_OUTCOME,
	CARD_IDENTITY_MODE,
	DEVICE_STATE,
	hardwareId,
	JWS_ALGORITHM,
	MILLISECONDS_PER_SECOND,
} from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { CardRepository } from "../repositories/card.repository"
import { CardBindingService } from "../services/card-binding.service"
import type { LoginChallengeService } from "../services/login-challenge.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import type { CardRow, NewCard } from "../types/login.types"

const OWNER_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222"
const MINUTE = 60_000

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
const exported = publicKey.export({ format: "jwk" })
const DEVICE_JWK = { kty: "EC" as const, crv: "P-256" as const, x: exported.x as string, y: exported.y as string }
const DEVICE: Device = {
	id: "33333333-3333-4333-8333-333333333333",
	state: DEVICE_STATE.APPROVED,
	hwId: hardwareId(DEVICE_JWK),
	publicKeyJwk: DEVICE_JWK,
	groupCode: null,
	loginMethods: {},
}

function bindingBody(): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
	const claims = {
		challenge_id: "44444444-4444-4444-8444-444444444444",
		value: "nonce",
		identifier: "04A1B2C3",
		binding_code: "ABCDEFGH2345",
		iat: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
	}
	const input = `${encode({ alg: JWS_ALGORITHM, typ: "JWT" })}.${encode(claims)}`
	const signature = createSign("sha256").update(input).sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
	return `${input}.${signature.toString("base64url")}`
}

interface Harness {
	service: CardBindingService
	inserted: NewCard[]
	audited: NewAuditEvent[]
}

function harness(
	existingOwner: string | undefined,
	deviceRejection?: ProblemException,
	owner: { isActive: boolean; activeAtLock: boolean } = { isActive: true, activeAtLock: true },
): Harness {
	const state: Harness = { service: undefined as unknown as CardBindingService, inserted: [], audited: [] }
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const proofs = {
		ofApprovedDevice: async () => {
			if (deviceRejection !== undefined) {
				throw deviceRejection
			}
			return DEVICE
		},
	} as unknown as DeviceProofService
	const policies = {
		current: async () => ({ cardIdentityMode: CARD_IDENTITY_MODE.UID_BINDING }),
	} as unknown as LoginPolicyService
	const challenges = { consume: async () => ({ confirmedUserId: null }) } as unknown as LoginChallengeService
	const cards = {
		findBindingCode: async () => ({
			code_hash: "hash",
			user_id: OWNER_ID,
			expires_at: new Date(Date.now() + MINUTE),
			consumed_at: null,
		}),
		findValidCard: async () =>
			existingOwner === undefined ? undefined : ({ id: "card-1", user_id: existingOwner } as CardRow),
		consumeBindingCode: async () => undefined,
		insertCard: async (_sql: unknown, next: NewCard) => {
			state.inserted.push(next)
			return { id: "card-2", user_id: next.userId, short_uid: next.shortUid, bound_at: next.boundAt }
		},
	} as unknown as CardRepository
	const users = {
		findById: async () => ({ id: OWNER_ID, displayName: "Jana Nováková", isActive: owner.isActive }),
		lockActive: async () => owner.activeAtLock,
	} as unknown as AppUserRepository
	const audit = {
		append: async (_sql: unknown, event: NewAuditEvent) => {
			state.audited.push(event)
		},
	} as unknown as AuditRepository
	state.service = new CardBindingService(database, proofs, policies, challenges, cards, users, audit)
	return state
}

async function codeOf(work: Promise<unknown>): Promise<string> {
	const error: unknown = await work.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the binding went through")
	}
	return error.code
}

const REQUEST = {} as Request

describe("CardBindingService.complete", () => {
	it("binds a free card to the user of the code", async () => {
		const state = harness(undefined)
		const receipt = await state.service.complete(REQUEST, bindingBody())
		expect(receipt.card_id).toBe("card-2")
		expect(state.inserted).toEqual([expect.objectContaining({ userId: OWNER_ID })])
	})

	it("CAP-005-S04 refuses a card bound to another user and records the refusal", async () => {
		const state = harness(OTHER_USER_ID)
		expect(await codeOf(state.service.complete(REQUEST, bindingBody()))).toBe(ERROR_CODE.CARD_ALREADY_BOUND)
		expect(state.inserted).toEqual([])
		expect(state.audited).toEqual([
			expect.objectContaining({
				outcome: AUDIT_OUTCOME.FAILURE,
				details: expect.objectContaining({ reason: ERROR_CODE.CARD_ALREADY_BOUND }),
			}),
		])
	})

	it("CAP-005-R12 founds no binding for a revoked user", async () => {
		const state = harness(undefined, undefined, { isActive: false, activeAtLock: false })
		expect(await codeOf(state.service.complete(REQUEST, bindingBody()))).toBe(ERROR_CODE.CARD_BINDING_CODE_INVALID)
		expect(state.inserted).toEqual([])
	})

	it("CAP-005-R12 founds no binding when the user is revoked during the binding", async () => {
		const state = harness(undefined, undefined, { isActive: true, activeAtLock: false })
		expect(await codeOf(state.service.complete(REQUEST, bindingBody()))).toBe(ERROR_CODE.CARD_BINDING_CODE_INVALID)
		expect(state.inserted).toEqual([])
	})

	it("CAP-005-S06 founds no binding from a device the server does not know", async () => {
		const state = harness(undefined, new ProblemException(401, ERROR_CODE.DEVICE_UNKNOWN))
		expect(await codeOf(state.service.complete(REQUEST, bindingBody()))).toBe(ERROR_CODE.DEVICE_UNKNOWN)
		expect(state.inserted).toEqual([])
	})
})
