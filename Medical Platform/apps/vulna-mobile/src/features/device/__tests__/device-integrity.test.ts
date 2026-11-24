import { beforeEach, describe, expect, it, vi } from "vitest"
import { checkDeviceIntegrity, leaveIntegrityBlock, watchDeviceIntegrity } from "../device-integrity"

const native = vi.hoisted(() => ({
	listeners: new Map<string, (detection: { signals: readonly string[] }) => void>(),
	removed: 0,
	missing: false,
	stored: undefined as unknown,
	serialized: 0,
	leavingPorts: undefined as Record<string, unknown> | undefined,
	startBlock: undefined as unknown,
	leaves: true,
}))

vi.mock("@ansora/core-mobile", () => ({
	OS_INTEGRITY_EVENT: { DETECTED: "detected" },
	osIntegrity: () => {
		if (native.missing) {
			throw new Error("Cannot find native module 'OsIntegrity'")
		}
		return {
			addListener: (event: string, listener: (detection: { signals: readonly string[] }) => void) => {
				native.listeners.set(event, listener)
				return {
					remove: () => {
						native.listeners.delete(event)
						native.removed += 1
					},
				}
			},
		}
	},
	blockForSignals: async (_ports: unknown, signals: readonly string[]) => {
		if (signals.length === 0) {
			return undefined
		}
		native.stored ??= { detectedAt: "2026-10-29T08:00:00.000Z", signals, registered: true }
		return native.stored
	},
	integrityBlock: async () => native.startBlock,
	leaveBlockForNewRegistration: async (ports: Record<string, unknown>) => {
		native.leavingPorts = ports
		return native.leaves
	},
}))
vi.mock("../device-registration", () => ({
	isDeviceRegistered: async () => true,
	forgetRegistration: async () => undefined,
}))
vi.mock("../integrity-blocks", () => ({ integrityBlocks: { name: "blocks" } }))
vi.mock("../block-markers", () => ({ blockMarkers: { name: "markers" } }))
vi.mock("../remote-erasure", () => ({
	afterEarlierErasure: <T>(work: () => Promise<T>) => {
		native.serialized += 1
		return work()
	},
}))

async function settled(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
	native.listeners.clear()
	native.removed = 0
	native.missing = false
	native.stored = undefined
	native.serialized = 0
	native.leavingPorts = undefined
	native.startBlock = undefined
	native.leaves = true
})

describe("watch over the integrity of the device while the app is open", () => {
	it("CAP-008-S02 blocks the app on a signal the running check found", async () => {
		const blocks: unknown[] = []
		watchDeviceIntegrity((block) => blocks.push(block))

		native.listeners.get("detected")?.({ signals: ["debugger"] })
		await settled()

		expect(blocks).toEqual([{ detectedAt: "2026-10-29T08:00:00.000Z", signals: ["debugger"], registered: true }])
	})

	it("does not block on a report without a signal", async () => {
		const blocks: unknown[] = []
		watchDeviceIntegrity((block) => blocks.push(block))

		native.listeners.get("detected")?.({ signals: [] })
		await settled()

		expect(blocks).toEqual([])
	})

	it("stops listening when the watch ends", () => {
		const stop = watchDeviceIntegrity(() => undefined)

		stop()

		expect(native.removed).toBe(1)
		expect(native.listeners.size).toBe(0)
	})

	it("CAP-008-S02 hands over no block that was still being stored when the watch ended", async () => {
		const blocks: unknown[] = []
		const stop = watchDeviceIntegrity((block) => blocks.push(block))

		native.listeners.get("detected")?.({ signals: ["debugger"] })
		stop()
		await settled()

		expect(blocks).toEqual([])
	})

	it("keeps the app working when the native check is missing", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		native.missing = true

		const stop = watchDeviceIntegrity(() => undefined)

		expect(() => stop()).not.toThrow()
		warn.mockRestore()
	})
})

describe("new registration after the block", () => {
	it("CAP-006-R19 leaves the block after the erasures before it with the stored block and the marker store", async () => {
		expect(await leaveIntegrityBlock()).toBe(true)
		expect(native.serialized).toBe(1)
		expect(native.leavingPorts).toMatchObject({ blocks: { name: "blocks" }, markers: { name: "markers" } })
	})

	it("CAP-006-S13 starts working again when the stored block can be left at start", async () => {
		native.startBlock = { detectedAt: "2026-10-29T08:00:00.000Z", signals: ["root"], registered: true }

		expect(await checkDeviceIntegrity()).toBeUndefined()
	})

	it("CAP-008-R07 stays blocked at start while the stored block cannot be left", async () => {
		native.startBlock = { detectedAt: "2026-10-29T08:00:00.000Z", signals: ["root"], registered: true }
		native.leaves = false

		expect(await checkDeviceIntegrity()).toEqual(native.startBlock)
	})

	it("does not try to leave when the start found no block", async () => {
		expect(await checkDeviceIntegrity()).toBeUndefined()
		expect(native.leavingPorts).toBeUndefined()
	})
})
