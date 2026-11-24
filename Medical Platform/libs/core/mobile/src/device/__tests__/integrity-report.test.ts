import {
	DEVICE_EVENT_TYPE,
	type DeviceEvent,
	ERROR_CODE,
	INTEGRITY_SIGNAL,
	type IntegrityReport,
	LOCAL_DATA_DELETION_REASON,
} from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import type { DeviceReport } from "../device-events"
import type { IntegrityBlock } from "../integrity-block"
import { type IntegrityReportPorts, recordIntegrityDeletion, reportIntegrityBlock } from "../integrity-report"
import { ERASURE_STATE } from "../remote-erasure"
import { DEVICE_KEY, fakeDevice, recordedAll } from "./device-report-fake"

const DETECTED_AT = "2026-10-29T08:00:00.000Z"
const LATER = new Date("2026-10-29T09:00:00.000Z")
const RELEASE_AT = "2026-11-05T08:00:00.000Z"
const AFTER_RELEASE = new Date("2026-11-05T08:00:00.000Z")

const DELETION: DeviceEvent = {
	idempotency_key: "33333333-3333-4333-8333-333333333333",
	type: DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION,
	originated_at: DETECTED_AT,
	user_id: null,
	details: {
		reason: LOCAL_DATA_DELETION_REASON.OS_MODIFICATION,
		count: 4,
		oldest_acquired_at: "2026-10-28T07:00:00.000Z",
	},
}

const ERASED: DeviceReport = { deviceKey: DEVICE_KEY, events: [DELETION], releaseAt: RELEASE_AT }

const BLOCK: IntegrityBlock = {
	detectedAt: DETECTED_AT,
	signals: [INTEGRITY_SIGNAL.ROOT, INTEGRITY_SIGNAL.DEBUGGER],
	registered: true,
	unsentItems: { count: 4, oldestAcquiredAt: "2026-10-28T07:00:00.000Z" },
}

function reportingDevice(block: IntegrityBlock = BLOCK) {
	const device = fakeDevice(ERASED)
	let stored: IntegrityBlock | undefined = block
	let forgotten = false
	let now = LATER
	const steps: string[] = []
	const integrityReports: IntegrityReport[] = []
	let integrityAnswer: () => void = () => {
		throw new TypeError("Network request failed")
	}
	const ports: IntegrityReportPorts = {
		...device.ports,
		reportEvents: async (events) => {
			steps.push("events")
			return await device.ports.reportEvents(events)
		},
		blocks: {
			read: async () => stored,
			write: async (next) => {
				stored = next
			},
			clear: async () => {
				stored = undefined
			},
		},
		reportIntegrity: async (next) => {
			steps.push("integrity")
			integrityReports.push(next)
			integrityAnswer()
		},
		unsentItems: async () => ({ count: 0, oldestAcquiredAt: null }),
		eraseLocalData: async () => undefined,
		forgetDeviceKey: async () => {
			steps.push("forget key")
			forgotten = true
		},
		newEventKey: async () => DELETION.idempotency_key,
		now: () => now,
	}
	return {
		...device,
		ports,
		steps,
		integrityReports,
		storedBlock: () => stored,
		deviceKeyForgotten: () => forgotten,
		acceptIntegrity: () => {
			integrityAnswer = () => undefined
		},
		refuseIntegrity: (code: string) => {
			integrityAnswer = () => {
				throw Object.assign(new Error("refused"), { code })
			}
		},
		setNow: (date: Date) => {
			now = date
		},
	}
}

describe("report of the block to the server", () => {
	it("CAP-008-S07 reports the block first, then the deletion, and only then forgets the device key", async () => {
		const device = reportingDevice()
		device.acceptIntegrity()
		device.answerWith(recordedAll)

		const state = await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.steps).toEqual(["integrity", "events", "forget key"])
		expect(device.integrityReports).toEqual([
			{
				signals: [INTEGRITY_SIGNAL.ROOT, INTEGRITY_SIGNAL.DEBUGGER],
				detected_at: DETECTED_AT,
				unsent_items: { count: 4, oldest_acquired_at: "2026-10-28T07:00:00.000Z" },
			},
		])
		expect(device.reported).toEqual([[DELETION]])
		expect(device.storedBlock()).toEqual({ ...BLOCK, reportedAt: LATER.toISOString() })
		expect(state).toBe(ERASURE_STATE.RELEASED)
	})

	it("CAP-008-S03 keeps the device key and the deletion while the server cannot be reached", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = reportingDevice()

		const state = await reportIntegrityBlock(device.ports, BLOCK)

		expect(state).toBe(ERASURE_STATE.REPORTING)
		expect(device.steps).toEqual(["integrity"])
		expect(device.stored()).toEqual(ERASED)
		expect(device.storedBlock()?.reportedAt).toBeUndefined()
		expect(device.deviceKeyForgotten()).toBe(false)
		warn.mockRestore()
	})

	it("CAP-025-S15 does not report the block again and keeps sending the deletion until the server takes it", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = reportingDevice({ ...BLOCK, reportedAt: LATER.toISOString() })

		const state = await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.steps).toEqual(["events"])
		expect(state).toBe(ERASURE_STATE.REPORTING)
		expect(device.deviceKeyForgotten()).toBe(false)
		warn.mockRestore()
	})

	it("Q-072 CAP-025-S16 forgets the device key once the hold has passed even without the report", async () => {
		const device = reportingDevice()
		device.setNow(AFTER_RELEASE)

		const state = await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.steps).toEqual(["forget key"])
		expect(device.stored()).toBeUndefined()
		expect(device.storedBlock()?.reportAbandonedAt).toBe(AFTER_RELEASE.toISOString())
		expect(state).toBe(ERASURE_STATE.RELEASED)
	})

	it("CAP-007-R11 stops reporting the block of a revoked device and still reports the deletion", async () => {
		const device = reportingDevice()
		device.refuseIntegrity(ERROR_CODE.DEVICE_REVOKED)
		device.answerWith(recordedAll)

		const state = await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.steps).toEqual(["integrity", "events", "forget key"])
		expect(device.storedBlock()).toEqual({ ...BLOCK, reportAbandonedAt: LATER.toISOString() })
		expect(state).toBe(ERASURE_STATE.RELEASED)
	})

	it("CAP-007-R11 does not report the block again once the server refused it for good", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = reportingDevice({ ...BLOCK, reportAbandonedAt: LATER.toISOString() })

		await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.steps).toEqual(["events"])
		warn.mockRestore()
	})

	it("keeps trying while the server refuses the report for a passing reason", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const device = reportingDevice()
		device.refuseIntegrity(ERROR_CODE.RETRY)

		expect(await reportIntegrityBlock(device.ports, BLOCK)).toBe(ERASURE_STATE.REPORTING)
		expect(device.storedBlock()).toEqual(BLOCK)
		warn.mockRestore()
	})

	it("CAP-008-R13 CAP-008-S10 reports nothing for an unregistered device", async () => {
		const device = reportingDevice({ ...BLOCK, registered: false })

		expect(await reportIntegrityBlock(device.ports, { ...BLOCK, registered: false })).toBe(ERASURE_STATE.NONE)
		expect(device.steps).toEqual([])
	})

	it("reports the block the erasure handed over when the stored one cannot be read", async () => {
		const device = reportingDevice()
		device.acceptIntegrity()
		device.answerWith(recordedAll)
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		device.ports.blocks.read = async () => {
			throw new Error("secure store unavailable")
		}

		await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.integrityReports[0]?.unsent_items.count).toBe(4)
		warn.mockRestore()
	})
})

describe("content of the report", () => {
	it("CAP-008-S08 carries only the signals, the moment and the lost items", async () => {
		const device = reportingDevice()
		device.acceptIntegrity()

		await reportIntegrityBlock(device.ports, BLOCK)

		expect(Object.keys(device.integrityReports[0] ?? {}).sort()).toEqual(["detected_at", "signals", "unsent_items"])
	})

	it("reports an empty queue as nothing lost", async () => {
		const empty = { ...BLOCK, unsentItems: undefined }
		const device = reportingDevice(empty)
		device.acceptIntegrity()

		await reportIntegrityBlock(device.ports, empty)

		expect(device.integrityReports[0]?.unsent_items).toEqual({ count: 0, oldest_acquired_at: null })
	})

	it("CAP-008-R11 keeps the lost items the erasure counted when the stored block lost them", async () => {
		const { unsentItems: _counted, ...withoutItems } = BLOCK
		const device = reportingDevice(withoutItems)
		device.acceptIntegrity()

		await reportIntegrityBlock(device.ports, BLOCK)

		expect(device.integrityReports[0]?.unsent_items.count).toBe(4)
	})
})

describe("report of the block once the device key no longer waits", () => {
	it("CAP-025-S16 stops promising the report once the key was let go by another erasure", async () => {
		const recorded = { ...BLOCK, deletionRecordedAt: DETECTED_AT }
		const device = reportingDevice(recorded)
		await device.ports.reports.update(() => undefined)

		expect(await reportIntegrityBlock(device.ports, recorded)).toBe(ERASURE_STATE.NONE)
		expect(device.steps).toEqual([])
		expect(device.storedBlock()?.reportAbandonedAt).toBe(LATER.toISOString())
	})

	it("CAP-008-R10 still reports the block when the deletion could not be recorded", async () => {
		const device = reportingDevice()
		device.acceptIntegrity()
		await device.ports.reports.update(() => undefined)

		expect(await reportIntegrityBlock(device.ports, BLOCK)).toBe(ERASURE_STATE.NONE)
		expect(device.steps).toEqual(["integrity"])
		expect(device.storedBlock()?.reportedAt).toBe(LATER.toISOString())
	})
})

describe("deletion recorded with the block", () => {
	const CONTEXT = { userId: null, deviceKeyHoldSeconds: 604_800 }

	it("CAP-008-R09 records the deletion of the lost items once and notes it with the block", async () => {
		const device = reportingDevice()
		await device.ports.reports.update(() => undefined)

		const recorded = await recordIntegrityDeletion(device.ports, BLOCK, CONTEXT)

		expect(device.stored()?.events).toEqual([{ ...DELETION, originated_at: LATER.toISOString() }])
		expect(recorded.deletionRecordedAt).toBe(LATER.toISOString())
		expect(device.storedBlock()).toEqual(recorded)
	})

	it("CAP-025-R22 records no second deletion after the device key was let go", async () => {
		const device = reportingDevice()
		await device.ports.reports.update(() => undefined)
		const recorded = { ...BLOCK, deletionRecordedAt: DETECTED_AT }

		expect(await recordIntegrityDeletion(device.ports, recorded, CONTEXT)).toEqual(recorded)
		expect(device.stored()).toBeUndefined()
	})

	it("CAP-008-R13 records nothing for a device the server did not know", async () => {
		const device = reportingDevice()
		await device.ports.reports.update(() => undefined)
		const unregistered = { ...BLOCK, registered: false }

		expect(await recordIntegrityDeletion(device.ports, unregistered, CONTEXT)).toEqual(unregistered)
		expect(device.stored()).toBeUndefined()
	})
})
