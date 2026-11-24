import { DELIVERY_CLOSURE_NOTE_MAX_LENGTH, DELIVERY_CLOSURE_REASON } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { deliveryClosureSchema } from "../dto/delivery-closure.input.dto"

const { NOT_REQUIRED } = DELIVERY_CLOSURE_REASON

describe("the closure the administration may send ✓ administration.yaml DeliveryClosure", () => {
	it("CAP-023-S26 refuses a closure without a reason or with a reason outside the list", () => {
		expect(deliveryClosureSchema.safeParse({}).success).toBe(false)
		expect(deliveryClosureSchema.safeParse({ reason: "retry" }).success).toBe(false)
	})

	it("trims the note and takes a blank note for no note", () => {
		expect(deliveryClosureSchema.parse({ reason: NOT_REQUIRED, note: "  v AMIS  " })).toEqual({
			reason: NOT_REQUIRED,
			note: "v AMIS",
		})
		expect(deliveryClosureSchema.parse({ reason: NOT_REQUIRED, note: "   " })).toEqual({
			reason: NOT_REQUIRED,
			note: undefined,
		})
	})

	it("refuses a note over the limit and unknown fields", () => {
		const longNote = "x".repeat(DELIVERY_CLOSURE_NOTE_MAX_LENGTH + 1)

		expect(deliveryClosureSchema.safeParse({ reason: NOT_REQUIRED, note: longNote }).success).toBe(false)
		expect(deliveryClosureSchema.safeParse({ reason: NOT_REQUIRED, retry: true }).success).toBe(false)
	})
})
