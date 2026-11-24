import { LOCAL_DATA_DELETION_REASON } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import { deviceReportOf, localDataDeletionEvent, recordDeviceEvents, sendDeviceEvents } from "../device-events"
import { DEVICE_KEY, fakeDevice, OTHER_DEVICE_KEY, recordedAll } from "./device-report-fake"

const ORIGINATED_AT = new Date("2026-10-27T08:00:00.000Z")
const OPERATOR = "22222222-2222-4222-8222-222222222222"

function deletion(key: string) {
	return localDataDeletionEvent(key, ORIGINATED_AT, OPERATOR, LOCAL_DATA_DELETION_REASON.LOCAL_COPY_EXPIRED, {
		count: 2,
		oldestAcquiredAt: "2026-10-26T07:00:00.000Z",
	})
}

const FIRST = deletion("33333333-3333-4333-8333-333333333333")
const SECOND = deletion("44444444-4444-4444-8444-444444444444")

describe("audit events that arise only on the device CAP-025-R22", () => {
	it("CAP-026-R10 keeps every recorded event until the server returns its key, then forgets them", async () => {
		const device = fakeDevice()
		await recordDeviceEvents(device.ports, [FIRST])
		await recordDeviceEvents(device.ports, [SECOND])

		expect(await sendDeviceEvents(device.ports)).toBe(2)
		expect(device.stored()?.events).toEqual([FIRST, SECOND])

		device.answerWith(recordedAll)
		expect(await sendDeviceEvents(device.ports)).toBe(0)
		expect(device.reported.at(-1)).toEqual([FIRST, SECOND])
		expect(device.stored()).toBeUndefined()
	})

	it("keeps the event the server did not return among the recorded ones", async () => {
		const device = fakeDevice()
		await recordDeviceEvents(device.ports, [FIRST, SECOND])
		device.answerWith(() => [FIRST.idempotency_key])

		expect(await sendDeviceEvents(device.ports)).toBe(1)
		expect(device.stored()?.events).toEqual([SECOND])
	})

	it("sends nothing when no event waits", async () => {
		const device = fakeDevice()
		const reportEvents = vi.spyOn(device.ports, "reportEvents")

		expect(await sendDeviceEvents(device.ports)).toBe(0)
		expect(reportEvents).not.toHaveBeenCalled()
	})

	it("CAP-006-S06 drops the events of another device key, as after a new installation", async () => {
		const device = fakeDevice({ deviceKey: OTHER_DEVICE_KEY, events: [FIRST], releaseAt: null })

		expect(await sendDeviceEvents(device.ports)).toBe(0)
		expect(device.reported).toEqual([])
		expect(device.stored()).toBeUndefined()

		await recordDeviceEvents(device.ports, [SECOND])
		expect(device.stored()).toEqual({ deviceKey: DEVICE_KEY, events: [SECOND], releaseAt: null })
	})

	it("reads back a stored report and refuses anything else", () => {
		const report = { deviceKey: DEVICE_KEY, events: [FIRST], releaseAt: "2026-11-03T08:00:00.000Z" }

		expect(deviceReportOf(JSON.stringify(report))).toEqual(report)
		expect(deviceReportOf(JSON.stringify({ ...report, releaseAt: null }))).toEqual({ ...report, releaseAt: null })
		expect(deviceReportOf(null)).toBeUndefined()
		expect(deviceReportOf("{")).toBeUndefined()
		expect(deviceReportOf(JSON.stringify({ ...report, releaseAt: "later" }))).toBeUndefined()
		expect(deviceReportOf(JSON.stringify({ ...report, events: "none" }))).toBeUndefined()
	})
})
