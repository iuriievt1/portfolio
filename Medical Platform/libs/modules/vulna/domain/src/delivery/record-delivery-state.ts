import {
	CLOSABLE_DELIVERY_INSTANCE_STATES,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	type DeliveryInstanceState,
	type DeliveryState,
} from "@ansora/contracts"
import { ACQUISITION_STATE, type AcquisitionState } from "../entities/acquisition"

const { CONFIRMED, CLOSED_BY_ADMINISTRATOR } = DELIVERY_INSTANCE_STATE

// datovy-model.md 4 „Pořízení“ pravidlo 3, CAP-023-R28
const FAILED_INSTANCE_STATES: readonly DeliveryInstanceState[] = CLOSABLE_DELIVERY_INSTANCE_STATES
const FINISHED_INSTANCE_STATES: readonly DeliveryInstanceState[] = [CONFIRMED, CLOSED_BY_ADMINISTRATOR]

// datovy-model.md 4 „Pořízení“
export interface RecordDeliveryStates {
	parents: readonly DeliveryState[]
	instances: readonly DeliveryInstanceState[]
}

export type AssembledRecordState = Exclude<
	AcquisitionState,
	typeof ACQUISITION_STATE.DRAFT | typeof ACQUISITION_STATE.RECEIVED
>

// datovy-model.md 4 „Pořízení“ pravidla 3–5 a 7, CAP-023-R09, CAP-023-R28
export function assembledRecordStateOf(states: RecordDeliveryStates): AssembledRecordState {
	const hasFailed =
		states.parents.includes(DELIVERY_STATE.ASSEMBLY_FAILED) ||
		states.instances.some((state) => FAILED_INSTANCE_STATES.includes(state))
	if (hasFailed) {
		return ACQUISITION_STATE.FAILED
	}
	if (!states.parents.every((state) => state === DELIVERY_STATE.ASSEMBLED)) {
		return ACQUISITION_STATE.ASSEMBLING
	}
	if (states.instances.every((state) => state === CONFIRMED)) {
		return ACQUISITION_STATE.DELIVERED
	}
	if (states.instances.every((state) => FINISHED_INSTANCE_STATES.includes(state))) {
		return ACQUISITION_STATE.CLOSED_BY_ADMINISTRATOR
	}
	return ACQUISITION_STATE.ASSEMBLING
}
