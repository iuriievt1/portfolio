import {
	DEVICE_EVENT_BATCH_MAX_EVENTS,
	DEVICE_EVENT_TYPE,
	type DeviceEvent,
	LOCAL_DATA_DELETION_REASON,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { type DeviceReport, localDataDeletionEvent } from "../device-events"
import {
	ERASURE_STATE,
	type ErasurePorts,
	eraseAfterRevocation,
	recordLocalDataDeletion,
	resumeErasure,
} from "../remote-erasure"
import { DEVICE_KEY, fakeDevice, OTHER_DEVICE_KEY, recordedAll } from "./device-report-fake"

const ERASED_AT = new Date("2026-10-26T08:00:00.000Z")
const HOLD_SECONDS = 604_800
const RELEASE_AT = "2026-11-02T08:00:00.000Z"
const EVENT_KEY = "33333333-3333-4333-8333-333333333333"
const USER_ID = "22222222-2222-4222-8222-222222222222"

const DELETION: DeviceEvent = {
	idempotency_key: EVENT_KEY,
	type: DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION,
	originated_at: ERASED_AT.toISOString(),
	user_id: USER_ID,
	details: {
		reason: LOCAL_DATA_DELETION_REASON.DEVICE_REVOCATION,
		count: 2,
		oldest_acquired_at: "2026-10-25T14:00:00.000Z",
	},
}

const ROUTINE_DELETION = localDataDeletionEvent(
	"55555555-5555-4555-8555-555555555555",
	new Date("2026-10-25T20:00:00.000Z"),
	USER_ID,
	LOCAL_DATA_DELETION_REASON.LOCAL_COPY_EXPIRED,
	{ count: 1, oldestAcquiredAt: "2026-10-24T09:00:00.000Z" },
)

function erasingDevice(initial?: DeviceReport) {
	const device = fakeDevice(initial)
	let erasures = 0
	let forgotten = false
	let now = ERASED_AT
	const ports: ErasurePorts = {
		...device.ports,
		deviceKey: async () => (forgotten ? OTHER_DEVICE_KEY : device.ports.deviceKey()),
		unsentItems: async () => ({ count: 2, oldestAcquiredAt: "2026-10-25T14:00:00.000Z" }),
		eraseLocalData: async () => {
			erasures += 1
		},
		forgetDeviceKey: async () => {
			forgotten = true
		},
		newEventKey: async () => EVENT_KEY,
		now: () => now,
	}
	return {
		...device,
		ports,
		erasures: () => erasures,
		deviceKeyForgotten: () => forgotten,
		setNow: (date: Date) => {
			now = date
		},
	}
}

const CONTEXT = { userId: USER_ID, deviceKeyHoldSeconds: HOLD_SECONDS }

describe("erasure of the local data after the device was revoked", () => {
	it("CAP-007-R04 CAP-025-S14 erases the data, reports the deletion and only then forgets the device key", async () => {
		const device = erasingDevice()
		device.answerWith(recordedAll)

		const state = await eraseAfterRevocation(device.ports, CONTEXT)

		expect(device.erasures()).toBe(1)
		expect(device.reported).toEqual([[DELETION]])
		expect(device.deviceKeyForgotten()).toBe(true)
		expect(device.stored()).toBeUndefined()
		expect(state).toBe(ERASURE_STATE.RELEASED)
	})

	it("CAP-025-S15 sends the deletion first in one batch with the events that waited before it", async () => {
		const device = erasingDevice({ deviceKey: DEVICE_KEY, events: [ROUTINE_DELETION], releaseAt: null })
		device.answerWith(recordedAll)

		await eraseAfterRevocation(device.ports, CONTEXT)

		expect(device.reported).toEqual([[DELETION, ROUTINE_DELETION]])
		expect(device.deviceKeyForgotten()).toBe(true)
	})

	it("CAP-025-R22 puts the deletion into the first batch when more events wait than one batch takes", async () => {
		const waiting = Array.from({ length: DEVICE_EVENT_BATCH_MAX_EVENTS }, (_, index) => ({
			...ROUTINE_DELETION,
			idempotency_key: `routine-${index}`,
		}))
		const device = erasingDevice({ deviceKey: DEVICE_KEY, events: waiting, releaseAt: null })
		device.answerWith(recordedAll)

		await eraseAfterRevocation(device.ports, CONTEXT)

		expect(device.reported[0]?.[0]).toEqual(DELETION)
		expect(device.reported[0]).toHaveLength(DEVICE_EVENT_BATCH_MAX_EVENTS)
	})

	it("CAP-025-S15 keeps the device key and the events until the server takes the batch, erasing again on each contact", async () => {
		const device = erasingDevice()

		expect(await eraseAfterRevocation(device.ports, CONTEXT)).toBe(ERASURE_STATE.REPORTING)
		expect(device.deviceKeyForgotten()).toBe(false)
		expect(device.stored()).toEqual({ deviceKey: DEVICE_KEY, events: [DELETION], releaseAt: RELEASE_AT })

		device.answerWith(recordedAll)
		expect(await resumeErasure(device.ports)).toBe(ERASURE_STATE.RELEASED)
		expect(device.erasures()).toBe(2)
		expect(device.reported).toEqual([[DELETION], [DELETION]])
		expect(device.deviceKeyForgotten()).toBe(true)
	})

	it("CAP-025-S16 forgets the device key once the hold has passed even without the batch taken", async () => {
		const device = erasingDevice()
		await eraseAfterRevocation(device.ports, { userId: null, deviceKeyHoldSeconds: HOLD_SECONDS })
		device.setNow(new Date(RELEASE_AT))

		expect(await resumeErasure(device.ports)).toBe(ERASURE_STATE.RELEASED)
		expect(device.reported).toHaveLength(1)
		expect(device.deviceKeyForgotten()).toBe(true)
		expect(device.stored()).toBeUndefined()
	})

	it("erases again and keeps the first deletion when the revocation arrives twice", async () => {
		const device = erasingDevice()
		await eraseAfterRevocation(device.ports, CONTEXT)
		device.setNow(new Date("2026-10-27T08:00:00.000Z"))

		await eraseAfterRevocation(device.ports, { userId: null, deviceKeyHoldSeconds: 60 })

		expect(device.erasures()).toBe(2)
		expect(device.stored()).toEqual({ deviceKey: DEVICE_KEY, events: [DELETION], releaseAt: RELEASE_AT })
	})

	it("CAP-006-S06 drops an erasure made with another device key, as after a new installation", async () => {
		const device = erasingDevice({ deviceKey: OTHER_DEVICE_KEY, events: [DELETION], releaseAt: RELEASE_AT })

		expect(await resumeErasure(device.ports)).toBe(ERASURE_STATE.NONE)
		expect(device.stored()).toBeUndefined()
		expect(device.erasures()).toBe(0)
		expect(device.reported).toEqual([])
	})

	it("erases nothing while only routine events wait", async () => {
		const device = erasingDevice({ deviceKey: DEVICE_KEY, events: [ROUTINE_DELETION], releaseAt: null })

		expect(await resumeErasure(device.ports)).toBe(ERASURE_STATE.NONE)
		expect(device.erasures()).toBe(0)
		expect(device.deviceKeyForgotten()).toBe(false)
	})
})

describe("record of the deletion when the operating system was modified", () => {
	const MODIFICATION = { ...CONTEXT, userId: null, reason: LOCAL_DATA_DELETION_REASON.OS_MODIFICATION }

	it("CAP-008-R09 CAP-008-S07 records the deletion with its reason and the lost items and keeps the device key", async () => {
		const device = erasingDevice({ deviceKey: DEVICE_KEY, events: [ROUTINE_DELETION], releaseAt: null })

		await recordLocalDataDeletion(device.ports, MODIFICATION)

		const deletion = {
			...DELETION,
			user_id: null,
			details: { ...DELETION.details, reason: LOCAL_DATA_DELETION_REASON.OS_MODIFICATION },
		}
		expect(device.stored()).toEqual({
			deviceKey: DEVICE_KEY,
			events: [deletion, ROUTINE_DELETION],
			releaseAt: RELEASE_AT,
		})
		expect(device.reported).toEqual([])
		expect(device.erasures()).toBe(0)
		expect(device.deviceKeyForgotten()).toBe(false)
	})

	it("CAP-008-R06 records the deletion only once", async () => {
		const device = erasingDevice()

		await recordLocalDataDeletion(device.ports, MODIFICATION)
		await recordLocalDataDeletion(device.ports, MODIFICATION)

		expect(device.stored()?.events).toHaveLength(1)
	})
})
