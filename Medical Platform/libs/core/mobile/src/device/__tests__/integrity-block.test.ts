import { INTEGRITY_SIGNAL, type IntegritySignal } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import type { BlockMarker } from "../block-marker"
import {
	type BlockLeavePorts,
	blockForSignals,
	type IntegrityBlock,
	type IntegrityPorts,
	integrityBlock,
	integrityBlockOf,
	leaveBlockForNewRegistration,
} from "../integrity-block"

const DETECTED_AT = new Date("2026-10-29T08:00:00.000Z")
const BLOCKED_HW_ID = "blocked-hw-id"
const NEW_HW_ID = "new-hw-id"

interface FakeIntegrity {
	ports: IntegrityPorts & BlockLeavePorts
	stored: () => IntegrityBlock | undefined
	marker: () => BlockMarker | undefined
	isRegistered: () => boolean
	detections: () => number
	releaseKey: () => void
}

function fakeIntegrity(
	detected: () => Promise<readonly string[]>,
	registered = true,
	initial?: IntegrityBlock,
): FakeIntegrity {
	let block = initial
	let marker: BlockMarker | undefined
	let isRegistered = registered
	let hwId = BLOCKED_HW_ID
	let detections = 0
	return {
		ports: {
			blocks: {
				read: async () => block,
				write: async (next) => {
					block = next
				},
				clear: async () => {
					block = undefined
				},
			},
			markers: {
				read: async () => marker,
				write: async (next) => {
					marker = next
				},
				clear: async () => {
					marker = undefined
				},
			},
			integrity: {
				detect: () => {
					detections += 1
					return detected()
				},
			},
			isRegistered: async () => isRegistered,
			forgetRegistration: async () => {
				isRegistered = false
			},
			hardwareId: async () => hwId,
			now: () => DETECTED_AT,
		},
		stored: () => block,
		marker: () => marker,
		isRegistered: () => isRegistered,
		detections: () => detections,
		releaseKey: () => {
			hwId = NEW_HW_ID
		},
	}
}

function signals(...detected: string[]): () => Promise<readonly string[]> {
	return async () => detected
}

describe("block of a device with a modified operating system", () => {
	it("CAP-008-S01 CAP-008-R10 blocks on a single signal and keeps the moment of detection", async () => {
		const device = fakeIntegrity(signals(INTEGRITY_SIGNAL.MAGISK))

		const block = await integrityBlock(device.ports)

		const expected: IntegrityBlock = {
			detectedAt: DETECTED_AT.toISOString(),
			signals: [INTEGRITY_SIGNAL.MAGISK],
			registered: true,
			hwId: BLOCKED_HW_ID,
		}
		expect(block).toEqual(expected)
		expect(device.stored()).toEqual(expected)
	})

	it("CAP-008-R07 keeps the device blocked when the signal disappears", async () => {
		const earlier: IntegrityBlock = {
			detectedAt: "2026-10-28T08:00:00.000Z",
			signals: [INTEGRITY_SIGNAL.ROOT],
			registered: true,
		}
		const device = fakeIntegrity(signals(), true, earlier)

		expect(await integrityBlock(device.ports)).toEqual(earlier)
		expect(device.detections()).toBe(0)
	})

	it("lets a device without a signal work and remembers nothing", async () => {
		const device = fakeIntegrity(signals())

		expect(await integrityBlock(device.ports)).toBeUndefined()
		expect(device.stored()).toBeUndefined()
	})

	it("CAP-008-R13 remembers that the server did not know the device", async () => {
		const device = fakeIntegrity(signals(INTEGRITY_SIGNAL.EMULATOR), false)

		const block = await integrityBlock(device.ports)

		expect(block).toMatchObject({ registered: false })
		expect(block).not.toHaveProperty("hwId")
	})

	it("CAP-008-R03 blocks a registered device even when its HW ID cannot be read", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = fakeIntegrity(signals(INTEGRITY_SIGNAL.ROOT))
		device.ports.hardwareId = async () => {
			throw new Error("keystore unavailable")
		}

		const block = await integrityBlock(device.ports)

		expect(block).toMatchObject({ registered: true, signals: [INTEGRITY_SIGNAL.ROOT] })
		expect(block).not.toHaveProperty("hwId")
		warn.mockRestore()
	})

	it("CAP-008-R11 keeps only the signals of the contract, each once and in its order", async () => {
		const device = fakeIntegrity(signals("debugger", "unknown", "root", "debugger"))

		expect((await integrityBlock(device.ports))?.signals).toEqual<IntegritySignal[]>([
			INTEGRITY_SIGNAL.ROOT,
			INTEGRITY_SIGNAL.DEBUGGER,
		])
	})

	it("CAP-008-R03 blocks even when the block cannot be stored", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = fakeIntegrity(signals(INTEGRITY_SIGNAL.ROOT))
		device.ports.blocks.read = async () => {
			throw new Error("storage unavailable")
		}
		device.ports.blocks.write = async () => {
			throw new Error("storage unavailable")
		}

		expect(await integrityBlock(device.ports)).toMatchObject({ signals: [INTEGRITY_SIGNAL.ROOT] })
		warn.mockRestore()
	})

	it("CAP-008-S04 does not block a device whose check failed", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = fakeIntegrity(async () => {
			throw new Error("native check failed")
		})

		expect(await integrityBlock(device.ports)).toBeUndefined()
		expect(device.stored()).toBeUndefined()
		warn.mockRestore()
	})
})

describe("new registration after the block", () => {
	const blocked: IntegrityBlock = {
		detectedAt: "2026-10-28T08:00:00.000Z",
		signals: [INTEGRITY_SIGNAL.ROOT],
		registered: true,
		hwId: BLOCKED_HW_ID,
	}

	it("CAP-006-S13 leaves the block with the marker of the predecessor once its key is gone and root is removed", async () => {
		const device = fakeIntegrity(signals(), true, blocked)
		device.releaseKey()

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(true)
		expect(device.stored()).toBeUndefined()
		expect(device.marker()).toEqual({ predecessorHwId: BLOCKED_HW_ID, detectedAt: blocked.detectedAt })
		expect(device.isRegistered()).toBe(false)
	})

	it("CAP-025-R22 keeps the block while the key of the blocked registration is still held", async () => {
		const device = fakeIntegrity(signals(), true, blocked)

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
		expect(device.stored()).toEqual(blocked)
		expect(device.marker()).toBeUndefined()
	})

	it("CAP-008-S04 keeps the block while the modification is still found", async () => {
		const device = fakeIntegrity(signals(INTEGRITY_SIGNAL.ROOT), true, blocked)
		device.releaseKey()

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
		expect(device.stored()).toEqual(blocked)
		expect(device.marker()).toBeUndefined()
	})

	it("CAP-006-R19 keeps the block when the check, the HW ID, the marker or forgetting the registration fails", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const failing = [
			(device: FakeIntegrity) => {
				device.ports.integrity.detect = async () => {
					throw new Error("native check failed")
				}
			},
			(device: FakeIntegrity) => {
				device.ports.hardwareId = async () => {
					throw new Error("keystore unavailable")
				}
			},
			(device: FakeIntegrity) => {
				device.ports.markers.write = async () => {
					throw new Error("storage unavailable")
				}
			},
			(device: FakeIntegrity) => {
				device.ports.forgetRegistration = async () => {
					throw new Error("storage unavailable")
				}
			},
		]
		for (const fail of failing) {
			const device = fakeIntegrity(signals(), true, blocked)
			device.releaseKey()
			fail(device)

			expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
			expect(device.stored()).toEqual(blocked)
		}
		warn.mockRestore()
	})

	it("CAP-006-R19 leaves only once when it is asked twice", async () => {
		const device = fakeIntegrity(signals(), true, blocked)
		device.releaseKey()
		let forgotten = 0
		device.ports.forgetRegistration = async () => {
			forgotten += 1
		}

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(true)
		expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
		expect(forgotten).toBe(1)
	})

	it("CAP-006-R19 never leaves a block that does not know the HW ID of its registration", async () => {
		const withoutHwId: IntegrityBlock = { ...blocked, hwId: undefined }
		const device = fakeIntegrity(signals(), true, withoutHwId)
		device.releaseKey()

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
		expect(device.detections()).toBe(0)
	})

	it("CAP-008-R13 never leaves the block of a device the server did not know", async () => {
		const unregistered: IntegrityBlock = { ...blocked, registered: false, hwId: undefined }
		const device = fakeIntegrity(signals(), false, unregistered)
		device.releaseKey()

		expect(await leaveBlockForNewRegistration(device.ports)).toBe(false)
		expect(device.stored()).toEqual(unregistered)
	})

	it("CAP-008-R07 the check at start keeps the stored block and leaves nothing on its own", async () => {
		const device = fakeIntegrity(signals(), true, blocked)
		device.releaseKey()

		expect(await integrityBlock(device.ports)).toEqual(blocked)
		expect(device.marker()).toBeUndefined()
	})
})

describe("block on signals found while the app is open", () => {
	it("CAP-008-S02 blocks on the signals the running check reported", async () => {
		const device = fakeIntegrity(signals())

		const block = await blockForSignals(device.ports, [INTEGRITY_SIGNAL.DEBUGGER])

		expect(block).toEqual({
			detectedAt: DETECTED_AT.toISOString(),
			signals: [INTEGRITY_SIGNAL.DEBUGGER],
			registered: true,
			hwId: BLOCKED_HW_ID,
		})
		expect(device.stored()).toEqual(block)
		expect(device.detections()).toBe(0)
	})

	it("CAP-008-R07 keeps the first block when another signal arrives", async () => {
		const earlier: IntegrityBlock = {
			detectedAt: "2026-10-28T08:00:00.000Z",
			signals: [INTEGRITY_SIGNAL.ROOT],
			registered: false,
		}
		const device = fakeIntegrity(signals(), true, earlier)

		expect(await blockForSignals(device.ports, [INTEGRITY_SIGNAL.FRIDA])).toEqual(earlier)
	})

	it("does not block on a report without a signal of the contract", async () => {
		const device = fakeIntegrity(signals())

		expect(await blockForSignals(device.ports, [])).toBeUndefined()
		expect(await blockForSignals(device.ports, ["unknown"])).toBeUndefined()
		expect(device.stored()).toBeUndefined()
	})
})

describe("stored block of the device", () => {
	const block: IntegrityBlock = {
		detectedAt: "2026-10-29T08:00:00.000Z",
		signals: [INTEGRITY_SIGNAL.FRIDA],
		registered: false,
	}

	it("reads back what was stored", () => {
		expect(integrityBlockOf(JSON.stringify(block))).toEqual(block)
	})

	it("CAP-008-S03 reads back when the block reached the server", () => {
		const reported: IntegrityBlock = { ...block, reportedAt: "2026-10-29T09:00:00.000Z" }

		expect(integrityBlockOf(JSON.stringify(reported))).toEqual(reported)
		expect(integrityBlockOf(JSON.stringify({ ...block, reportedAt: "soon" }))).toBeUndefined()
	})

	it("CAP-025-S16 reads back when the report could no longer leave", () => {
		const abandoned: IntegrityBlock = { ...block, reportAbandonedAt: "2026-11-05T08:00:00.000Z" }

		expect(integrityBlockOf(JSON.stringify(abandoned))).toEqual(abandoned)
		expect(integrityBlockOf(JSON.stringify({ ...block, reportAbandonedAt: "never" }))).toBeUndefined()
	})

	it("CAP-008-R11 reads back the items the erasure counted", () => {
		const counted: IntegrityBlock = {
			...block,
			unsentItems: { count: 4, oldestAcquiredAt: "2026-10-28T07:00:00.000Z" },
		}
		const empty: IntegrityBlock = { ...block, unsentItems: { count: 0, oldestAcquiredAt: null } }

		expect(integrityBlockOf(JSON.stringify(counted))).toEqual(counted)
		expect(integrityBlockOf(JSON.stringify(empty))).toEqual(empty)
		expect(
			integrityBlockOf(JSON.stringify({ ...block, unsentItems: { count: -1, oldestAcquiredAt: null } })),
		).toBeUndefined()
		expect(
			integrityBlockOf(JSON.stringify({ ...block, unsentItems: { count: 1.5, oldestAcquiredAt: null } })),
		).toBeUndefined()
		expect(
			integrityBlockOf(JSON.stringify({ ...block, unsentItems: { count: 1, oldestAcquiredAt: "x" } })),
		).toBeUndefined()
	})

	it("CAP-006-R19 reads back the HW ID of the blocked registration only for a registered device", () => {
		const withHwId: IntegrityBlock = { ...block, registered: true, hwId: BLOCKED_HW_ID }

		expect(integrityBlockOf(JSON.stringify(withHwId))).toEqual(withHwId)
		expect(integrityBlockOf(JSON.stringify({ ...withHwId, hwId: "" }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...withHwId, hwId: 7 }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...withHwId, registered: false }))).toBeUndefined()
	})

	it("CAP-025-R22 reads back when the deletion was recorded", () => {
		const recorded: IntegrityBlock = { ...block, registered: true, deletionRecordedAt: "2026-10-29T08:01:00.000Z" }

		expect(integrityBlockOf(JSON.stringify(recorded))).toEqual(recorded)
		expect(integrityBlockOf(JSON.stringify({ ...recorded, deletionRecordedAt: "2026" }))).toBeUndefined()
	})

	it("reads no moment that is not the full one the app wrote", () => {
		expect(integrityBlockOf(JSON.stringify({ ...block, detectedAt: "2026" }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...block, detectedAt: "2026-10-29" }))).toBeUndefined()
	})

	it("reads nothing from an empty, damaged or foreign record", () => {
		expect(integrityBlockOf(null)).toBeUndefined()
		expect(integrityBlockOf("{")).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...block, signals: [] }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...block, signals: ["unknown"] }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ ...block, detectedAt: "yesterday" }))).toBeUndefined()
		expect(integrityBlockOf(JSON.stringify({ detectedAt: block.detectedAt, signals: block.signals }))).toBeUndefined()
	})
})
