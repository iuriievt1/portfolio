import { DELIVERY_CLOSURE_REASON } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { deliveryClosureOf, deliveryClosureSchema } from "@/features/deliveries/lib/delivery-closure.schema"

const { ARCHIVED_BY_OTHER_MEANS } = DELIVERY_CLOSURE_REASON

describe("closing a delivery instance ✓ CAP-023-R28, administration.yaml DeliveryClosure", () => {
	it("CAP-023-S26 refuses a closure without a reason", () => {
		expect(deliveryClosureSchema.safeParse({ reason: "", note: "" }).success).toBe(false)
	})

	it("leaves out an empty note and trims a filled one", () => {
		expect(deliveryClosureOf(deliveryClosureSchema.parse({ reason: ARCHIVED_BY_OTHER_MEANS, note: "   " }))).toEqual({
			reason: ARCHIVED_BY_OTHER_MEANS,
		})
		expect(
			deliveryClosureOf(deliveryClosureSchema.parse({ reason: ARCHIVED_BY_OTHER_MEANS, note: " v AMIS " })),
		).toEqual({ reason: ARCHIVED_BY_OTHER_MEANS, note: "v AMIS" })
	})
})
