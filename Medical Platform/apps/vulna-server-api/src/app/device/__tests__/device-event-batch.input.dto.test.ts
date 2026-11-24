import { describe, expect, it } from "vitest"
import { deviceEventBatchSchema } from "../dto/device-event-batch.input.dto"

const DELETION = {
	idempotency_key: "33333333-3333-4333-8333-333333333333",
	type: "local-data-deletion",
	originated_at: "2026-10-26T08:00:00.000Z",
	user_id: null,
	details: { reason: "device_revocation", count: 2, oldest_acquired_at: "2026-10-25T14:00:00.000Z" },
}

describe("batch of device events", () => {
	it("CAP-025-R22 accepts a deletion with its closed details", () => {
		expect(deviceEventBatchSchema.safeParse({ events: [DELETION] }).success).toBe(true)
	})

	it("refuses details the type does not have", () => {
		const extra = { ...DELETION, details: { ...DELETION.details, patient_identifier: "800101/1234" } }
		expect(deviceEventBatchSchema.safeParse({ events: [extra] }).success).toBe(false)
	})

	it("refuses an event type that ceased to exist", () => {
		const discard = { ...DELETION, type: "draft-acquisition-discard" }
		expect(deviceEventBatchSchema.safeParse({ events: [discard] }).success).toBe(false)
	})

	it("refuses a batch that repeats an idempotency key", () => {
		expect(deviceEventBatchSchema.safeParse({ events: [DELETION, DELETION] }).success).toBe(false)
		const lettered = { ...DELETION, idempotency_key: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }
		const shouted = { ...lettered, idempotency_key: lettered.idempotency_key.toUpperCase() }
		expect(deviceEventBatchSchema.safeParse({ events: [lettered, shouted] }).success).toBe(false)
	})

	it("refuses an empty batch and a negative count", () => {
		const negative = { ...DELETION, details: { ...DELETION.details, count: -1 } }
		expect(deviceEventBatchSchema.safeParse({ events: [] }).success).toBe(false)
		expect(deviceEventBatchSchema.safeParse({ events: [negative] }).success).toBe(false)
	})
})
