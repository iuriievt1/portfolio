import { beforeEach, describe, expect, it, vi } from "vitest"
import { enrolThisDevice } from "../device-enrolment"

const enrolment = vi.hoisted(() => ({
	sent: [] as unknown[],
	marker: undefined as string | undefined,
	markerUnreadable: false,
	remembered: [] as unknown[],
}))

vi.mock("@ansora/core-mobile", () => ({
	DEVICE_STATUS: { UNREACHABLE: "unreachable", PENDING_APPROVAL: "pending_approval" },
	MANAGED_ENROLMENT_KEYS: {},
	cryptoAndKeys: () => ({}),
	managedConfiguration: () => ({ read: async () => ({}) }),
	readManagedEnrolment: () => ({ registrationSecret: "mdm-secret", groupCode: "tablety-3b" }),
	enrolDevice: async (_api: unknown, _keys: unknown, managed: unknown) => {
		enrolment.sent.push(managed)
		return { kind: "pending_approval" }
	},
}))
vi.mock("../../../api/device", () => ({ deviceApi: {} }))
vi.mock("../block-markers", () => ({
	blockedPredecessor: async () => {
		if (enrolment.markerUnreadable) {
			throw new Error("keychain unavailable")
		}
		return enrolment.marker === undefined ? {} : { blockedPredecessorHwId: enrolment.marker }
	},
}))
vi.mock("../device-registration", () => ({
	rememberRegistration: (status: unknown) => {
		enrolment.remembered.push(status)
	},
}))

beforeEach(() => {
	enrolment.sent = []
	enrolment.marker = undefined
	enrolment.markerUnreadable = false
	enrolment.remembered = []
})

describe("registration of this device", () => {
	it("CAP-006-S13 reports the blocked predecessor together with the secret from MDM", async () => {
		enrolment.marker = "blocked-hw-id"

		const status = await enrolThisDevice()

		expect(enrolment.sent).toEqual([
			{ registrationSecret: "mdm-secret", groupCode: "tablety-3b", blockedPredecessorHwId: "blocked-hw-id" },
		])
		expect(enrolment.remembered).toEqual([status])
	})

	it("CAP-006-R06 registers without a predecessor when no block preceded", async () => {
		await enrolThisDevice()

		expect(enrolment.sent).toEqual([{ registrationSecret: "mdm-secret", groupCode: "tablety-3b" }])
	})

	it("CAP-006-R19 sends no registration when the marker of the predecessor cannot be read", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		enrolment.markerUnreadable = true

		expect(await enrolThisDevice()).toEqual({ kind: "unreachable" })
		expect(enrolment.sent).toEqual([])
		warn.mockRestore()
	})
})
