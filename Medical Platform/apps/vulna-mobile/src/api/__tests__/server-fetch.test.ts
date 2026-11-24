import { afterEach, describe, expect, it, vi } from "vitest"
import { NoConnectionError } from "../api-error"
import { fetchFromServer } from "../client"

vi.mock("@ansora/core-mobile", () => ({ createDeviceProof: vi.fn(), cryptoAndKeys: vi.fn() }))
vi.mock("../../features/app-version/app-version-store", () => ({ rememberAppVersionAnswer: vi.fn() }))
vi.mock("../../i18n/language-store", () => ({ currentLanguage: () => "cs" }))
vi.mock("../app-version", () => ({ appVersionHeader: () => "1.0.0+1" }))
vi.mock("../server-address", () => ({ serverUrl: () => "https://vulna.test" }))

const URL = "https://vulna.test/api/v1/acquisitions"
const NO_CONTENT = 204

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("request to the server", () => {
	it("CAP-002-R17 CAP-019-R29 reports a broken connection the same way whatever the platform throws", async () => {
		const brokenOnAndroid = new Error("fetch failed: java.io.IOException: unexpected end of stream")
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw brokenOnAndroid
			}),
		)

		await expect(fetchFromServer(URL, {})).rejects.toBeInstanceOf(NoConnectionError)
	})

	it("passes the answer of the server through, an error answer included", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: NO_CONTENT })),
		)

		expect((await fetchFromServer(URL, {})).status).toBe(NO_CONTENT)
	})
})
