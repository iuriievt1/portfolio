import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { deliveryPageSchema } from "../dto/delivery-page.input.dto"

describe("the delivery filter the administration may send ✓ administration.yaml listDeliveries", () => {
	it("NAB-345 filters by the state of the delivery and of its instances", () => {
		const query = { state: DELIVERY_STATE.ASSEMBLY_FAILED, instance_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW }

		expect(deliveryPageSchema.parse(query)).toEqual(query)
	})

	it("refuses an unknown state and an unknown parameter", () => {
		expect(deliveryPageSchema.safeParse({ state: "delivered" }).success).toBe(false)
		expect(deliveryPageSchema.safeParse({ acquisition_id: "x" }).success).toBe(false)
	})
})
