import {
	DELIVERY_INSTANCE_STATES,
	DELIVERY_STATES,
	type DeliveryInstanceState,
	type DeliveryState,
} from "@ansora/contracts"
import type { DeliveryFilter } from "@/features/deliveries/types/delivery.types"
import { deliveriesPagePath } from "@/lib/routes"

// DESIGN.md 9.1, administration.yaml listDeliveries
const DELIVERY_FILTER_PARAM = {
	STATE: "state",
	INSTANCE_STATE: "instance_state",
} as const

export const ANY_STATE = ""

export const EMPTY_DELIVERY_FILTER: DeliveryFilter = { state: undefined, instanceState: undefined }

export function deliveryStateOf(value: string | null): DeliveryState | undefined {
	return DELIVERY_STATES.find((known) => known === value)
}

export function deliveryInstanceStateOf(value: string | null): DeliveryInstanceState | undefined {
	return DELIVERY_INSTANCE_STATES.find((known) => known === value)
}

// DESIGN.md 9.1
export function deliveryFilterOf(params: URLSearchParams): DeliveryFilter {
	return {
		state: deliveryStateOf(params.get(DELIVERY_FILTER_PARAM.STATE)),
		instanceState: deliveryInstanceStateOf(params.get(DELIVERY_FILTER_PARAM.INSTANCE_STATE)),
	}
}

export function isFiltered(filter: DeliveryFilter): boolean {
	return filter.state !== undefined || filter.instanceState !== undefined
}

// administration.yaml listDeliveries state, instance_state
export function deliveryQueryOf(filter: DeliveryFilter): Record<string, string | undefined> {
	return {
		[DELIVERY_FILTER_PARAM.STATE]: filter.state,
		[DELIVERY_FILTER_PARAM.INSTANCE_STATE]: filter.instanceState,
	}
}

// DESIGN.md 9.1
export function searchParamsOf(filter: DeliveryFilter): Record<string, string> {
	return Object.fromEntries(
		Object.entries(deliveryQueryOf(filter)).filter((entry): entry is [string, string] => entry[1] !== undefined),
	)
}

export function deliveriesPathOf(filter: DeliveryFilter): string {
	const query = new URLSearchParams(searchParamsOf(filter)).toString()
	return query === "" ? deliveriesPagePath() : `${deliveriesPagePath()}?${query}`
}
