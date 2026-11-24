import { DEVICE_UNBLOCK_REASON_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { deviceUnblockingSchema } from "../dto/device-unblocking.input.dto"

describe("unblocking of a device", () => {
	it("CAP-007-S07 keeps the result of the review without the surrounding spaces", () => {
		expect(deviceUnblockingSchema.parse({ reason: "  Falešný poplach.  " })).toEqual({ reason: "Falešný poplach." })
	})

	it("refuses a review without a result, one longer than the contract allows and an unknown field", () => {
		expect(deviceUnblockingSchema.safeParse({ reason: "   " }).success).toBe(false)
		expect(deviceUnblockingSchema.safeParse({ reason: "a".repeat(DEVICE_UNBLOCK_REASON_MAX_LENGTH + 1) }).success).toBe(
			false,
		)
		expect(deviceUnblockingSchema.safeParse({}).success).toBe(false)
		expect(deviceUnblockingSchema.safeParse({ reason: "Ověřeno.", state: "approved" }).success).toBe(false)
	})
})
