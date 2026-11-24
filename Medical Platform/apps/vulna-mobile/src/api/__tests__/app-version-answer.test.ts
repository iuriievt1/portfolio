import { ERROR_CODE } from "@ansora/contracts"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ACCEPTS_OUTDATED_APP, exchange } from "../client"

const answers = vi.hoisted(() => [] as boolean[])

vi.mock("@ansora/core-mobile", () => ({ createDeviceProof: vi.fn(), cryptoAndKeys: vi.fn() }))
vi.mock("../../features/app-version/app-version-store", () => ({
	rememberAppVersionAnswer: (isRejected: boolean) => {
		answers.push(isRejected)
	},
}))
vi.mock("../../i18n/language-store", () => ({ currentLanguage: () => "cs" }))
vi.mock("../app-version", () => ({ appVersionHeader: () => "1.0.0+1" }))
vi.mock("../server-address", () => ({ serverUrl: () => "https://vulna.test" }))

const OK = 200
const FORBIDDEN = 403

function answered(status: number, code?: string): () => Promise<Response> {
	return async () => new Response(code === undefined ? null : JSON.stringify({ code }), { status })
}

beforeEach(() => {
	answers.length = 0
})

describe("answer of the server to the app version", () => {
	it("CAP-012-S11 remembers that the server rejected the version", async () => {
		await expect(exchange(answered(FORBIDDEN, ERROR_CODE.APP_VERSION_UNSUPPORTED))).rejects.toMatchObject({
			code: ERROR_CODE.APP_VERSION_UNSUPPORTED,
		})

		expect(answers).toEqual([true])
	})

	it("CAP-012-R24 takes an answer to a checked request as the server accepting the version", async () => {
		await exchange(answered(OK))

		expect(answers).toEqual([false])
	})

	it("CAP-012-R25 E34 learns nothing about the version from a request the server takes even from an outdated app", async () => {
		await exchange(answered(OK), ACCEPTS_OUTDATED_APP)

		expect(answers).toEqual([])
	})
})
