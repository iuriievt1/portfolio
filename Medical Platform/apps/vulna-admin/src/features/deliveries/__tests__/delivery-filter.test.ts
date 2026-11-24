import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	deliveryFilterOf,
	deliveryQueryOf,
	EMPTY_DELIVERY_FILTER,
	isFiltered,
	searchParamsOf,
} from "@/features/deliveries/lib/delivery-filter"

describe("the filter of deliveries ✓ DESIGN.md 9.1, administration.yaml listDeliveries", () => {
	it("reads known states from the address and ignores the rest", () => {
		const filter = deliveryFilterOf(new URLSearchParams("state=assembly_failed&instance_state=clinical_safety"))

		expect(filter).toEqual({ state: DELIVERY_STATE.ASSEMBLY_FAILED, instanceState: undefined })
		expect(isFiltered(filter)).toBe(true)
		expect(isFiltered(EMPTY_DELIVERY_FILTER)).toBe(false)
	})

	it("writes only the chosen states to the address and to the query", () => {
		const filter = { state: undefined, instanceState: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW }

		expect(searchParamsOf(filter)).toEqual({ instance_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW })
		expect(deliveryQueryOf(filter)).toEqual({
			state: undefined,
			instance_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
		})
	})
})
