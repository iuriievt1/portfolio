import { createSign, generateKeyPairSync, type KeyObject, randomUUID } from "node:crypto"
import { DPOP_HEADER, DPOP_NONCE_HEADER, ERROR_CODE, WWW_AUTHENTICATE_HEADER } from "@ansora/contracts"
import {
	DEVICE_PROOF_TYPE,
	DEVICE_STATE,
	type DeviceState,
	hardwareId,
	JWS_ALGORITHM,
	MILLISECONDS_PER_SECOND,
	type PublicKeyJwk,
	USE_DPOP_NONCE_CHALLENGE,
} from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { DpopNonceRequiredException } from "../exceptions/dpop-nonce-required.exception"
import type { DeviceRepository } from "../repositories/device.repository"
import { DeviceProofService } from "../services/device-proof.service"
import { DpopNonceService } from "../services/dpop-nonce.service"
import type { Device } from "../types/device.types"

const HOST = "vulna.example"
const PATH = "/api/v1/login/challenge"
const METHOD = "POST"

interface TestKey {
	privateKey: KeyObject
	jwk: PublicKeyJwk
}

function deviceKey(): TestKey {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { privateKey, jwk: { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string } }
}

function encoded(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url")
}

const NONCES = new DpopNonceService()
const WITHOUT_NONCE = null

function proofOf(
	key: TestKey,
	signer: KeyObject = key.privateKey,
	nonce: string | typeof WITHOUT_NONCE = NONCES.current(),
): string {
	const header = { typ: DEVICE_PROOF_TYPE, alg: JWS_ALGORITHM, jwk: key.jwk }
	const claims = {
		jti: randomUUID(),
		htm: METHOD,
		htu: `https://${HOST}${PATH}`,
		iat: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
		...(nonce === WITHOUT_NONCE ? {} : { nonce }),
	}
	const input = `${encoded(header)}.${encoded(claims)}`
	const signature = createSign("sha256").update(input).sign({ key: signer, dsaEncoding: "ieee-p1363" })
	return `${input}.${signature.toString("base64url")}`
}

function requestWith(proof: string | undefined): Request {
	const headers: Record<string, string> = proof === undefined ? {} : { [DPOP_HEADER.toLowerCase()]: proof }
	return {
		method: METHOD,
		protocol: "https",
		originalUrl: PATH,
		get: (name: string) => (name.toLowerCase() === "host" ? HOST : headers[name.toLowerCase()]),
		header: (name: string) => headers[name.toLowerCase()],
	} as unknown as Request
}

function serviceKnowing(key: TestKey, state: DeviceState | undefined): DeviceProofService {
	const device: Device | undefined =
		state === undefined
			? undefined
			: {
					id: "33333333-3333-4333-8333-333333333333",
					state,
					hwId: hardwareId(key.jwk),
					publicKeyJwk: key.jwk,
					groupCode: null,
					loginMethods: {},
				}
	const devices = {
		findByHwId: async () => device,
		forgetExpiredProofIdentifiers: async () => undefined,
		consumeProofIdentifier: async () => true,
	} as unknown as DeviceRepository
	return new DeviceProofService(devices, NONCES)
}

async function codeOf(work: Promise<unknown>): Promise<string> {
	const error: unknown = await work.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the device was let through")
	}
	return error.code
}

describe("DeviceProofService", () => {
	it("lets an approved device through", async () => {
		const key = deviceKey()
		const device = await serviceKnowing(key, DEVICE_STATE.APPROVED).ofApprovedDevice(requestWith(proofOf(key)))
		expect(device.hwId).toBe(hardwareId(key.jwk))
	})

	it("CAP-001-S08 refuses a device the server does not know", async () => {
		const key = deviceKey()
		const service = serviceKnowing(key, undefined)
		expect(await codeOf(service.ofApprovedDevice(requestWith(proofOf(key))))).toBe(ERROR_CODE.DEVICE_UNKNOWN)
	})

	it("CAP-001-S08 refuses a revoked device", async () => {
		const key = deviceKey()
		const service = serviceKnowing(key, DEVICE_STATE.REVOKED)
		expect(await codeOf(service.ofApprovedDevice(requestWith(proofOf(key))))).toBe(ERROR_CODE.DEVICE_REVOKED)
	})

	it("CAP-006-S03 CAP-001-S08 refuses a device still waiting for approval", async () => {
		const key = deviceKey()
		const service = serviceKnowing(key, DEVICE_STATE.PENDING_APPROVAL)
		expect(await codeOf(service.ofApprovedDevice(requestWith(proofOf(key))))).toBe(ERROR_CODE.DEVICE_PENDING_APPROVAL)
	})

	it("names the device of a correctly signed proof without the database", () => {
		const key = deviceKey()
		const service = serviceKnowing(key, undefined)
		expect(service.signedHardwareId(requestWith(proofOf(key)))).toBe(hardwareId(key.jwk))
		expect(service.signedHardwareId(requestWith(undefined))).toBeUndefined()
		expect(service.signedHardwareId(requestWith(proofOf(key, deviceKey().privateKey)))).toBeUndefined()
	})

	it("Q-082 asks for a nonce when the proof carries none", async () => {
		const key = deviceKey()
		const service = serviceKnowing(key, DEVICE_STATE.APPROVED)

		const error = await service
			.ofApprovedDevice(requestWith(proofOf(key, key.privateKey, WITHOUT_NONCE)))
			.catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(DpopNonceRequiredException)
		const refusal = error as DpopNonceRequiredException
		expect(refusal.getStatus()).toBe(401)
		expect(refusal.code).toBe(ERROR_CODE.RETRY)
		expect(refusal.headers).toEqual({
			[WWW_AUTHENTICATE_HEADER]: USE_DPOP_NONCE_CHALLENGE,
			[DPOP_NONCE_HEADER]: NONCES.current(),
		})
	})

	it("Q-082 asks for a fresh nonce when the proof carries one the server did not issue", async () => {
		const key = deviceKey()
		const service = serviceKnowing(key, DEVICE_STATE.APPROVED)

		const error = await service
			.ofApprovedDevice(requestWith(proofOf(key, key.privateKey, "stale")))
			.catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(DpopNonceRequiredException)
	})

	it("Q-082 asks for a nonce at registration too", () => {
		const key = deviceKey()
		const service = serviceKnowing(key, undefined)

		expect(() => service.ofNewDevice(requestWith(proofOf(key, key.privateKey, WITHOUT_NONCE)))).toThrow(
			DpopNonceRequiredException,
		)
		expect(service.ofNewDevice(requestWith(proofOf(key))).hwId).toBe(hardwareId(key.jwk))
	})
})
