import { ERROR_CODE } from "@ansora/contracts"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { exchange } from "../client"

const revocations = vi.hoisted(() => ({ count: 0 }))

vi.mock("@ansora/core-mobile", () => ({ createDeviceProof: vi.fn(), cryptoAndKeys: vi.fn() }))
vi.mock("../../features/app-version/app-version-store", () => ({ rememberAppVersionAnswer: vi.fn() }))
vi.mock("../../features/device/device-revocation-events", () => ({
	noteDeviceRevoked: () => {
		revocations.count += 1
	},
}))
vi.mock("../../i18n/language-store", () => ({ currentLanguage: () => "cs" }))
vi.mock("../app-version", () => ({ appVersionHeader: () => "1.0.0+1" }))
vi.mock("../server-address", () => ({ serverUrl: () => "https://vulna.test" }))

const UNAUTHORIZED = 401
const FORBIDDEN = 403

function answered(status: number, code?: string): () => Promise<Response> {
	return async () => new Response(code === undefined ? null : JSON.stringify({ code }), { status })
}

beforeEach(() => {
	revocations.count = 0
})

describe("revocation of the device in an answer of the server", () => {
	it("CAP-007-R11 CAP-012-S15 notes the revocation on the explicit code", async () => {
		await expect(exchange(answered(FORBIDDEN, ERROR_CODE.DEVICE_REVOKED))).rejects.toMatchObject({
			code: ERROR_CODE.DEVICE_REVOKED,
		})

		expect(revocations.count).toBe(1)
	})

	it("CAP-007-S09 CAP-007-S10 takes no other refusal for a revocation", async () => {
		await expect(exchange(answered(UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN))).rejects.toBeDefined()
		await expect(exchange(answered(FORBIDDEN))).rejects.toBeDefined()
		await expect(exchange(answered(UNAUTHORIZED, ERROR_CODE.DEVICE_UNKNOWN))).rejects.toBeDefined()
		await expect(exchange(answered(FORBIDDEN, ERROR_CODE.APP_VERSION_UNSUPPORTED))).rejects.toBeDefined()

		expect(revocations.count).toBe(0)
	})
})
