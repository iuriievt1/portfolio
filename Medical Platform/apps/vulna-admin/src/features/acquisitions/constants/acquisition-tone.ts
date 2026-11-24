import type { AdministeredAcquisitionState, DeliveryInstanceState } from "@ansora/contracts"
import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"

// datovy-model.md 4, CAP-023-R28
export const ACQUISITION_STATE_TONE: Readonly<Record<AdministeredAcquisitionState, PillTone>> = {
	draft: PILL_TONE.NEUTRAL,
	waiting_for_files: PILL_TONE.WARN,
	received: PILL_TONE.NEUTRAL,
	assembling: PILL_TONE.NEUTRAL,
	delivered: PILL_TONE.NEUTRAL,
	failed: PILL_TONE.CRITICAL,
	closed_by_administrator: PILL_TONE.WARN,
}

// CAP-023-R09, CAP-023-R28
export const PACS_STATUS_TONE: Readonly<Record<DeliveryInstanceState, PillTone>> = {
	waiting: PILL_TONE.NEUTRAL,
	sending: PILL_TONE.NEUTRAL,
	pending_verification: PILL_TONE.WARN,
	confirmed: PILL_TONE.NEUTRAL,
	temporarily_failed: PILL_TONE.WARN,
	permanently_failed: PILL_TONE.CRITICAL,
	held_for_review: PILL_TONE.CRITICAL,
	closed_by_administrator: PILL_TONE.WARN,
}
