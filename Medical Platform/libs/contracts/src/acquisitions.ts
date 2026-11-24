import type { components } from "./generated/administration"

type AdministrationSchemas = components["schemas"]

export type AdministeredAcquisitionState = AdministrationSchemas["AcquisitionDetail"]["state"]

// CAP-004-R10, administration.yaml AcquisitionDetail, datovy-model.md 4
export const ADMINISTERED_ACQUISITION_STATE = {
	DRAFT: "draft",
	WAITING_FOR_FILES: "waiting_for_files",
	RECEIVED: "received",
	ASSEMBLING: "assembling",
	DELIVERED: "delivered",
	FAILED: "failed",
	CLOSED_BY_ADMINISTRATOR: "closed_by_administrator",
} as const satisfies Record<string, AdministeredAcquisitionState>

export const ADMINISTERED_ACQUISITION_STATES: readonly AdministeredAcquisitionState[] =
	Object.values(ADMINISTERED_ACQUISITION_STATE)

// ADR-005 ř. 36, datovy-model.md 4 „Cíl doručení“
export const DELIVERY_TARGET = {
	PACS: "pacs",
} as const

export type DeliveryState = AdministrationSchemas["DeliveryState"]

// CAP-021-R03, CAP-022-R11, administration.yaml DeliveryState, datovy-model.md 4
export const DELIVERY_STATE = {
	WAITING_FOR_ASSEMBLY: "waiting_for_assembly",
	ASSEMBLED: "assembled",
	ASSEMBLY_FAILED: "assembly_failed",
} as const satisfies Record<string, DeliveryState>

export const DELIVERY_STATES: readonly DeliveryState[] = Object.values(DELIVERY_STATE)

// CAP-022-R11, CAP-022-R15, administration.yaml Delivery.reason, restartTextRecognition
export const ASSEMBLY_FAILURE_REASON = {
	OCR_FAILED: "ocr_failed",
} as const

// CAP-022-R11, CAP-022-R15, administration.yaml restartTextRecognition
export function hasTextRecognitionFailed(state: DeliveryState, reason: string | null): boolean {
	return state === DELIVERY_STATE.ASSEMBLY_FAILED && reason === ASSEMBLY_FAILURE_REASON.OCR_FAILED
}

export type DeliveryInstanceState = AdministrationSchemas["DeliveryInstanceState"]

// CAP-023-R09, CAP-023-R28, administration.yaml DeliveryInstanceState, datovy-model.md 4
export const DELIVERY_INSTANCE_STATE = {
	WAITING: "waiting",
	SENDING: "sending",
	PENDING_VERIFICATION: "pending_verification",
	CONFIRMED: "confirmed",
	TEMPORARILY_FAILED: "temporarily_failed",
	PERMANENTLY_FAILED: "permanently_failed",
	HELD_FOR_REVIEW: "held_for_review",
	CLOSED_BY_ADMINISTRATOR: "closed_by_administrator",
} as const satisfies Record<string, DeliveryInstanceState>

export const DELIVERY_INSTANCE_STATES: readonly DeliveryInstanceState[] = Object.values(DELIVERY_INSTANCE_STATE)

export function isDeliveryInstanceState(value: string): value is DeliveryInstanceState {
	return DELIVERY_INSTANCE_STATES.includes(value as DeliveryInstanceState)
}

export type HeldForReviewCause = NonNullable<AdministrationSchemas["DeliveryInstance"]["held_for_review_cause"]>

// CAP-023-R09, CAP-023-S19, CAP-023-S20, administration.yaml DeliveryInstance.held_for_review_cause
export const HELD_FOR_REVIEW_CAUSE = {
	DIMSE_STATUS: "dimse_status",
	ARTIFACT_SHA256_MISMATCH: "artifact_sha256_mismatch",
	STUDY_IDENTITY_CONFLICT: "study_identity_conflict",
} as const satisfies Record<string, HeldForReviewCause>

export type DeliveryTargetState = AdministrationSchemas["DeliveryTarget"]["state"]

// CAP-023-R23, CAP-023-R24, administration.yaml DeliveryTarget, datovy-model.md 4 „Cíl doručení“
export const DELIVERY_TARGET_STATE = {
	ACTIVE: "active",
	UNAVAILABLE: "unavailable",
	PAUSED: "paused",
} as const satisfies Record<string, DeliveryTargetState>

export type DeliveryClosureReason = AdministrationSchemas["DeliveryClosureReason"]

// CAP-023-R28, administration.yaml DeliveryClosureReason, datovy-model.md 4 „Doručení“
export const DELIVERY_CLOSURE_REASON = {
	DOCUMENTATION_REACQUIRED: "documentation_reacquired",
	ARCHIVED_BY_OTHER_MEANS: "archived_by_other_means",
	WRONG_PATIENT_OR_ENCOUNTER: "wrong_patient_or_encounter",
	NOT_REQUIRED: "not_required",
} as const satisfies Record<string, DeliveryClosureReason>

export const DELIVERY_CLOSURE_REASONS: readonly DeliveryClosureReason[] = Object.values(DELIVERY_CLOSURE_REASON)

export type ClosableDeliveryInstanceState = NonNullable<
	AdministrationSchemas["DeliveryInstance"]["closure"]
>["closed_from_state"]

// CAP-023-R28, administration.yaml closeDeliveryInstance
export const CLOSABLE_DELIVERY_INSTANCE_STATES: readonly ClosableDeliveryInstanceState[] = [
	DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED,
]

const CLOSABLE_STATES: readonly DeliveryInstanceState[] = CLOSABLE_DELIVERY_INSTANCE_STATES

export function isClosableDeliveryInstanceState(state: DeliveryInstanceState): state is ClosableDeliveryInstanceState {
	return CLOSABLE_STATES.includes(state)
}
