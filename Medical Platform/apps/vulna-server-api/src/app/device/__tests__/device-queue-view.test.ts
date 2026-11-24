import { DEVICE_STATE } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DeviceDetailRow } from "../types/device-administration.types"
import { deviceQueueOf } from "../utils/device-queue-view"

const REPORTED_AT = new Date("2026-10-16T08:00:05.000Z")
const DETECTED_AT = new Date("2026-10-16T08:00:00.000Z")
const OLDEST = new Date("2026-10-15T07:18:00.000Z")

function device(queue: Partial<DeviceDetailRow> = {}): DeviceDetailRow {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		state: DEVICE_STATE.APPROVED,
		public_key_jwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
		hw_id: "hardware",
		model: "SM-A576B",
		os_version: "16",
		platform: "android",
		managed_configuration: false,
		group_code: null,
		blocked_predecessor_hw_id: null,
		last_contact_at: null,
		login_methods: {},
		registered_at: DETECTED_AT,
		queue_waiting_count: null,
		queue_failed_count: null,
		queue_oldest_acquired_at: null,
		queue_detected_at: null,
		queue_reported_at: null,
		blocking_detected_at: null,
		blocking_signals: null,
		blocking_app_version: null,
		unblocked_at: null,
		unblocked_by_user_id: null,
		unblock_reason: null,
		predecessor_id: null,
		predecessor_blocking_detected_at: null,
		predecessor_blocking_signals: null,
		predecessor_blocking_app_version: null,
		...queue,
	}
}

describe("queue of a device in the administration CAP-019-R08", () => {
	it("CAP-007-S08 says the queue is not known when the device never reported it, never zero", () => {
		expect(deviceQueueOf(device())).toBeNull()
	})

	it("CAP-007-S03 shows the counts, the oldest item and when the device reported them", () => {
		const reported = device({
			queue_waiting_count: 3,
			queue_failed_count: 1,
			queue_oldest_acquired_at: OLDEST,
			queue_detected_at: DETECTED_AT,
			queue_reported_at: REPORTED_AT,
		})

		expect(deviceQueueOf(reported)).toEqual({
			waiting: 3,
			failed: 1,
			oldest_acquired_at: OLDEST.toISOString(),
			reported_at: REPORTED_AT.toISOString(),
			detected_at: DETECTED_AT.toISOString(),
		})
	})

	it("shows an empty queue as zero with no oldest item", () => {
		const empty = device({
			queue_waiting_count: 0,
			queue_failed_count: 0,
			queue_detected_at: DETECTED_AT,
			queue_reported_at: REPORTED_AT,
		})

		expect(deviceQueueOf(empty)).toMatchObject({ waiting: 0, failed: 0, oldest_acquired_at: null })
	})
})
