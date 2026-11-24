import type { IntegrityReport } from "@ansora/contracts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deviceApi, reportDeviceEvents, reportDeviceIntegrity } from "../device"

const answers = vi.hoisted(() => [] as boolean[])

vi.mock("@ansora/core-mobile", () => ({
	createDeviceProof: async () => "device-proof",
	cryptoAndKeys: () => ({
		deviceKey: async () => ({ publicKeyJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" } }),
	}),
}))
vi.mock("../../features/app-version/app-version-store", () => ({
	rememberAppVersionAnswer: (isRejected: boolean) => {
		answers.push(isRejected)
	},
}))
vi.mock("../../features/device/device-revocation-events", () => ({ noteDeviceRevoked: () => undefined }))
vi.mock("../../features/session/effective-configuration-store", () => ({
	rememberEffectiveConfiguration: () => undefined,
}))
vi.mock("../../i18n/language-store", () => ({ currentLanguage: () => "cs" }))
vi.mock("../app-version", () => ({ appVersionHeader: () => "0.9.0+7" }))
vi.mock("../server-address", () => ({ serverUrl: () => "https://vulna.test" }))

const OK = 200
const ACCEPTED = 202

const REPORT: IntegrityReport = {
	signals: ["root"],
	detected_at: "2026-10-29T08:00:00.000Z",
	unsent_items: { count: 0, oldest_acquired_at: null },
}

function serverAnswers(status: number, body?: unknown): void {
	vi.stubGlobal("fetch", async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

beforeEach(() => {
	answers.length = 0
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("answers to what a blocked device reports CAP-012-R24", () => {
	it("CAP-012-S14 keeps the rejected version when the server accepts the report of the block", async () => {
		serverAnswers(ACCEPTED)

		await reportDeviceIntegrity(REPORT)

		expect(answers).toEqual([])
	})

	it("CAP-012-S14 keeps the rejected version when the server takes the deletion of the local data", async () => {
		serverAnswers(OK, { recorded_keys: [] })

		await reportDeviceEvents([])

		expect(answers).toEqual([])
	})

	it("takes the answer to a request the server checks as the server accepting the version", async () => {
		serverAnswers(OK, { state: "approved" })

		await deviceApi.verifyDevice()

		expect(answers).toEqual([false])
	})
})
