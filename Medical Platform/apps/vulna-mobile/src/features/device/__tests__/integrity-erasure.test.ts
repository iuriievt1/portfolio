import type { IntegrityBlock } from "@ansora/core-mobile"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { eraseAfterIntegrityBlock, reportBlockToServer } from "../integrity-erasure"

const LOST = { count: 4, oldestAcquiredAt: "2026-10-28T07:00:00.000Z" }

const RECORDED_AT = "2026-10-29T08:00:01.000Z"

const device = vi.hoisted(() => ({
	steps: [] as string[],
	written: [] as unknown[],
	recorded: [] as { block: unknown; context: unknown }[],
	writeFails: false,
	recordFails: false,
	reports: [] as { ports: Record<string, unknown>; block: unknown }[],
	stored: undefined as unknown,
}))

vi.mock("@ansora/core-mobile", () => ({
	keepBlock: async (blocks: { write(block: unknown): Promise<void> }, block: unknown) => {
		await blocks.write(block).catch(() => undefined)
	},
	recordIntegrityDeletion: async (
		_ports: unknown,
		block: { registered: boolean; deletionRecordedAt?: string },
		context: unknown,
	) => {
		if (device.recordFails) {
			throw new Error("secure store unavailable")
		}
		if (!block.registered || block.deletionRecordedAt !== undefined) {
			return block
		}
		device.steps.push("record")
		device.recorded.push({ block, context })
		return { ...block, deletionRecordedAt: "2026-10-29T08:00:01.000Z" }
	},
	reportIntegrityBlock: async (ports: Record<string, unknown>, block: unknown) => {
		device.steps.push("report")
		device.reports.push({ ports, block })
		return "reporting"
	},
	storedIntegrityBlock: async () => device.stored,
}))
vi.mock("../../../api/device", () => ({ reportDeviceIntegrity: async () => undefined }))
vi.mock("../remote-erasure", () => ({
	ERASURE_PORTS: {},
	afterEarlierErasure: <T>(work: () => Promise<T>) => work(),
	eraseLocalData: async () => {
		device.steps.push("erase")
	},
	unsentItems: async () => {
		device.steps.push("count")
		return LOST
	},
}))
vi.mock("../integrity-blocks", () => ({
	integrityBlocks: {
		write: async (block: unknown) => {
			if (device.writeFails) {
				throw new Error("secure store unavailable")
			}
			device.steps.push("keep")
			device.written.push(block)
		},
	},
}))
vi.mock("../device-key-hold", () => ({ deviceKeyHoldSeconds: async () => 604_800 }))
vi.mock("../../session/session-store", () => ({ currentSession: () => undefined }))
vi.mock("../../upload/upload-queue", () => ({ stopUploadQueue: () => device.steps.push("stop queue") }))

const BLOCK: IntegrityBlock = { detectedAt: "2026-10-29T08:00:00.000Z", signals: ["root"], registered: true }

beforeEach(() => {
	device.steps = []
	device.written = []
	device.recorded = []
	device.writeFails = false
	device.recordFails = false
	device.reports = []
	device.stored = undefined
})

describe("erasure of the local data after the block", () => {
	it("CAP-008-S07 counts the lost items first, keeps them with the block, records the deletion and erases", async () => {
		const erased = await eraseAfterIntegrityBlock(BLOCK)

		expect(device.steps).toEqual(["stop queue", "count", "keep", "record", "erase"])
		expect(device.written).toEqual([{ ...BLOCK, unsentItems: LOST }])
		expect(device.recorded).toEqual([
			{ block: { ...BLOCK, unsentItems: LOST }, context: { userId: null, deviceKeyHoldSeconds: 604_800 } },
		])
		expect(erased).toEqual({ ...BLOCK, unsentItems: LOST, deletionRecordedAt: RECORDED_AT })
	})

	it("CAP-008-R13 CAP-008-S10 erases an unregistered device and records nothing for the server", async () => {
		await eraseAfterIntegrityBlock({ ...BLOCK, registered: false })

		expect(device.steps).toEqual(["stop queue", "count", "keep", "erase"])
	})

	it("CAP-025-R22 erases again after a restart and records no second deletion", async () => {
		device.stored = { ...BLOCK, unsentItems: LOST, deletionRecordedAt: RECORDED_AT }

		await eraseAfterIntegrityBlock(BLOCK)

		expect(device.steps).toEqual(["stop queue", "erase"])
	})

	it("CAP-008-S07 keeps the count of the first erasure when a second detection hands over the bare block", async () => {
		device.stored = { ...BLOCK, unsentItems: LOST }

		const erased = await eraseAfterIntegrityBlock(BLOCK)

		expect(device.steps).toEqual(["stop queue", "record", "erase"])
		expect(erased.unsentItems).toEqual(LOST)
	})

	it("CAP-008-R10 erases even when the deletion cannot be recorded", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		device.recordFails = true

		await eraseAfterIntegrityBlock(BLOCK)

		expect(device.steps.at(-1)).toBe("erase")
		warn.mockRestore()
	})

	it("CAP-008-R06 erases even when the counted items cannot be kept", async () => {
		device.writeFails = true

		await eraseAfterIntegrityBlock(BLOCK)

		expect(device.steps).toEqual(["stop queue", "count", "record", "erase"])
	})
})

describe("report of the block to the server", () => {
	it("CAP-008-R04 hands the block to the report with the store and the call of the server", async () => {
		const erased = { ...BLOCK, unsentItems: LOST }

		const shown = await reportBlockToServer(erased)

		expect(device.steps).toEqual(["report"])
		expect(device.reports[0]?.block).toEqual(erased)
		expect(Object.keys(device.reports[0]?.ports ?? {})).toEqual(expect.arrayContaining(["blocks", "reportIntegrity"]))
		expect(shown).toEqual(erased)
	})

	it("CAP-008-S03 hands back the stored block, so the screen learns that the server was told", async () => {
		const reported = { ...BLOCK, unsentItems: LOST, reportedAt: "2026-10-29T09:00:00.000Z" }
		device.stored = reported

		expect(await reportBlockToServer({ ...BLOCK, unsentItems: LOST })).toEqual(reported)
	})
})
