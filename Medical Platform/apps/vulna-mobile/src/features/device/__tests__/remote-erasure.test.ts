import { beforeEach, describe, expect, it, vi } from "vitest"

const ERASURE_STATE = vi.hoisted(() => ({ NONE: "none", REPORTING: "reporting", RELEASED: "released" }) as const)

const device = vi.hoisted(() => ({
	steps: [] as string[],
	erasures: [] as string[],
	nextErasure: "released" as string,
	nextResume: "none" as string,
}))

vi.mock("@ansora/core-mobile", () => ({
	ERASURE_STATE,
	backgroundQueue: () => ({ cancelAll: async () => device.steps.push("cancel uploads") }),
	cryptoAndKeys: () => ({
		eraseLocalData: async () => device.steps.push("erase vault"),
		forgetDeviceKey: async () => undefined,
	}),
	eraseAfterRevocation: async (ports: { eraseLocalData(): Promise<void> }) => {
		device.erasures.push("erase")
		await ports.eraseLocalData()
		return device.nextErasure
	},
	resumeErasure: async () => {
		device.erasures.push("resume")
		return device.nextResume
	},
}))
vi.mock("../device-events", () => ({ DEVICE_REPORT_PORTS: {} }))
vi.mock("../device-key-hold", () => ({ deviceKeyHoldSeconds: async () => 60 }))
vi.mock("../../app-version/app-version-store", () => ({ forgetAppVersionAnswer: () => device.steps.push("version") }))
vi.mock("../../code-lists/code-list-store", () => ({ forgetCodeLists: () => device.steps.push("code lists") }))
vi.mock("../../session/owner-language", () => ({ forgetOwnerLanguage: async () => device.steps.push("language") }))
vi.mock("../../session/session-actions", () => ({ forgetSessionOnDevice: () => device.steps.push("session") }))
vi.mock("../../session/session-store", () => ({ currentSession: () => undefined }))
vi.mock("../../upload/queue-report", () => ({
	queueReportOf: () => ({ waiting: 0, failed: 0, oldest_acquired_at: null }),
}))
vi.mock("../../upload/transfer-store", () => ({
	reopenQueueStorage: async () => device.steps.push("reopen queue"),
	transferBuffer: async () => ({ queued: async () => [] }),
}))
vi.mock("../../upload/upload-queue", () => ({ stopUploadQueue: () => device.steps.push("stop queue") }))
vi.mock("../../../utils/random-uuid", () => ({ randomUuid: async () => "33333333-3333-4333-8333-333333333333" }))

async function freshErasure() {
	vi.resetModules()
	device.steps.length = 0
	device.erasures.length = 0
	return await import("../remote-erasure")
}

describe("erasure of the app after the device was revoked", () => {
	beforeEach(() => {
		device.nextErasure = ERASURE_STATE.RELEASED
		device.nextResume = ERASURE_STATE.NONE
	})

	it("CAP-007-R04 stops the uploads, erases the vault and forgets what the app kept in memory", async () => {
		const erasure = await freshErasure()

		await erasure.eraseAfterRevocation()

		expect(device.steps).toEqual([
			"stop queue",
			"cancel uploads",
			"reopen queue",
			"erase vault",
			"reopen queue",
			"language",
			"session",
			"code lists",
			"version",
		])
	})

	it("CAP-007-R11 erases nothing again for a late revocation answer after the key was released", async () => {
		const erasure = await freshErasure()
		await erasure.eraseAfterRevocation()

		expect(await erasure.eraseAfterRevocation()).toBe(ERASURE_STATE.RELEASED)
		expect(await erasure.resumeErasure()).toBe(ERASURE_STATE.RELEASED)
		expect(device.erasures).toEqual(["erase"])
	})

	it("CAP-025-R22 resumes a waiting erasure only after the running one ended", async () => {
		device.nextErasure = ERASURE_STATE.REPORTING
		const erasure = await freshErasure()

		const running = erasure.eraseAfterRevocation()
		const resumed = erasure.resumeErasure()
		await Promise.all([running, resumed])

		expect(device.erasures).toEqual(["erase", "resume"])
	})

	it("CAP-007-R11 erases once for answers that arrive together", async () => {
		const erasure = await freshErasure()

		await Promise.all([erasure.eraseAfterRevocation(), erasure.eraseAfterRevocation()])

		expect(device.erasures).toEqual(["erase"])
	})
})
