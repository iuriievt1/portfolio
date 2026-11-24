import { beforeEach, describe, expect, it, vi } from "vitest"
import { forgetRegistration, isDeviceRegistered, rememberRegistration } from "../device-registration"

const DEVICE_STATUS = vi.hoisted(
	() =>
		({
			CHECKING: "checking",
			UNREGISTERED: "unregistered",
			PENDING_APPROVAL: "pending_approval",
			APPROVED: "approved",
			REVOKED: "revoked",
			BLOCKED: "blocked",
			UNREACHABLE: "unreachable",
		}) as const,
)

const store = vi.hoisted(() => ({ items: new Map<string, string>(), failing: false }))

vi.mock("@ansora/core-mobile", () => ({ DEVICE_STATUS }))
vi.mock("expo-secure-store", () => ({
	getItemAsync: async (key: string) => {
		if (store.failing) {
			throw new Error("keychain unavailable")
		}
		return store.items.get(key) ?? null
	},
	setItemAsync: async (key: string, value: string) => {
		store.items.set(key, value)
	},
}))

async function settled(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
	store.items.clear()
	store.failing = false
})

describe("registration of the device as the server last answered", () => {
	it("CAP-008-S10 treats a device the server never answered as unregistered", async () => {
		expect(await isDeviceRegistered()).toBe(false)
	})

	it("CAP-008-R04 treats a device the server knows as registered", async () => {
		for (const kind of [
			DEVICE_STATUS.PENDING_APPROVAL,
			DEVICE_STATUS.APPROVED,
			DEVICE_STATUS.REVOKED,
			DEVICE_STATUS.BLOCKED,
		]) {
			store.items.clear()
			rememberRegistration({ kind })
			await settled()

			expect(await isDeviceRegistered()).toBe(true)
		}
	})

	it("CAP-008-R13 forgets the registration once the server no longer knows the device", async () => {
		rememberRegistration({ kind: DEVICE_STATUS.APPROVED })
		await settled()
		rememberRegistration({ kind: DEVICE_STATUS.UNREGISTERED })
		await settled()

		expect(await isDeviceRegistered()).toBe(false)
	})

	it("CAP-006-R19 forgets the registration the block took away", async () => {
		rememberRegistration({ kind: DEVICE_STATUS.APPROVED })
		await settled()

		await forgetRegistration()

		expect(await isDeviceRegistered()).toBe(false)
	})

	it("keeps the last answer while the server cannot be reached", async () => {
		rememberRegistration({ kind: DEVICE_STATUS.APPROVED })
		await settled()
		rememberRegistration({ kind: DEVICE_STATUS.UNREACHABLE })
		rememberRegistration({ kind: DEVICE_STATUS.CHECKING })
		await settled()

		expect(await isDeviceRegistered()).toBe(true)
	})

	it("CAP-008-R04 treats a device as registered when its registration cannot be read", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		store.failing = true

		expect(await isDeviceRegistered()).toBe(true)
		warn.mockRestore()
	})
})
