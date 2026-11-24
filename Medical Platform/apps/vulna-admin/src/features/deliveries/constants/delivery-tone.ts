import type { DeliveryState, DeliveryTargetState } from "@ansora/contracts"
import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"

// CAP-021-R03, CAP-022-R11
export const DELIVERY_STATE_TONE: Readonly<Record<DeliveryState, PillTone>> = {
	waiting_for_assembly: PILL_TONE.NEUTRAL,
	assembled: PILL_TONE.NEUTRAL,
	assembly_failed: PILL_TONE.CRITICAL,
}

// CAP-023-R23, CAP-023-R24
export const TARGET_STATE_TONE: Readonly<Record<DeliveryTargetState, PillTone>> = {
	active: PILL_TONE.NEUTRAL,
	unavailable: PILL_TONE.WARN,
	paused: PILL_TONE.CRITICAL,
}
