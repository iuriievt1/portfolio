import { DELIVERY_INSTANCE_STATE, DELIVERY_INSTANCE_STATES, type DeliveryInstanceState } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { isDeliveryInstanceRetryable } from "../delivery"

const { CONFIRMED, HELD_FOR_REVIEW, PERMANENTLY_FAILED, CLOSED_BY_ADMINISTRATOR } = DELIVERY_INSTANCE_STATE

// administration.yaml DeliveryInstance.is_retryable
const NEVER_RETRIED: readonly DeliveryInstanceState[] = [
	CONFIRMED,
	HELD_FOR_REVIEW,
	PERMANENTLY_FAILED,
	CLOSED_BY_ADMINISTRATOR,
]

describe("whether the delivery core still works on an instance ✓ administration.yaml DeliveryInstance.is_retryable", () => {
	it.each(DELIVERY_INSTANCE_STATES)("ADR-005 ř. 27, CAP-023-R24, CAP-023-R28 for %s", (state) => {
		expect(isDeliveryInstanceRetryable(state)).toBe(!NEVER_RETRIED.includes(state))
	})
})
