import { DELIVERY_INSTANCE_STATE, type DeliveryInstanceState } from "@ansora/contracts"

// CAP-023-R26, datovy-model.md 4 „Doručení“ verification_rejections
export const NO_VERIFICATION_REJECTIONS = 0

// datovy-model.md 4 „Doručení“, backend.md 3 T4
export const SETTLED_INSTANCE_STATES: readonly DeliveryInstanceState[] = [
	DELIVERY_INSTANCE_STATE.CONFIRMED,
	DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED,
	DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR,
]

export function isDeliveryInstanceSettled(state: DeliveryInstanceState): boolean {
	return SETTLED_INSTANCE_STATES.includes(state)
}

// administration.yaml DeliveryInstance.is_retryable, ADR-005 ř. 27, CAP-023-R23, CAP-023-R24, CAP-023-R26, CAP-023-R28
export function isDeliveryInstanceRetryable(state: DeliveryInstanceState): boolean {
	return !isDeliveryInstanceSettled(state)
}
