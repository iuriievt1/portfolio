import type {
	AcquisitionKind,
	AdministrationContract,
	ClosableDeliveryInstanceState,
	DeliveryClosureReason,
	DeliveryInstanceState,
	DeliveryState,
	DeliveryTargetState,
	HeldForReviewCause,
} from "@ansora/contracts"
import type { MomentPage } from "../../infra/utils/cursor-moment"

type AdministrationSchemas = AdministrationContract.components["schemas"]

export type DeliveryView = AdministrationSchemas["Delivery"]
export type DeliveryInstanceView = AdministrationSchemas["DeliveryInstance"]
export type DeliveryTargetView = AdministrationSchemas["DeliveryTarget"]
export type DeliveriesPageView = AdministrationSchemas["DeliveriesPage"]

// datovy-model.md 4 „Cíl doručení“
export interface LockedTarget {
	state: DeliveryTargetState
	reason: string | null
}

// datovy-model.md 4 „Doručení“
export interface LockedVerification {
	verification_on_hold_at: Date | null
	verification_rejections: number
}

// datovy-model.md 4 „Doručení“, CAP-023-R28
export interface LockedInstance {
	state: DeliveryInstanceState
	acquisition_id: string
}

// datovy-model.md 4 „Doručení“, CAP-022-R15
export interface LockedDelivery {
	state: DeliveryState
	reason: string | null
	acquisition_id: string
}

// administration.yaml TextRecognitionRestart, CAP-022-R15, datovy-model.md 8
export interface RecognitionRestart {
	deliveryId: string
	acquisitionId: string
	reason: string
	administratorUserId: string
}

// administration.yaml DeliveryClosure, CAP-023-R28, datovy-model.md 8
export interface InstanceClosure {
	deliveryId: string
	instanceId: string
	acquisitionId: string
	from: ClosableDeliveryInstanceState
	reason: DeliveryClosureReason
	note: string | undefined
	administratorUserId: string
}

export interface DeliveryRow {
	id: string
	acquisition_id: string
	acquisition_kind: AcquisitionKind
	acquisition_closed_at: Date
	target: string
	state: DeliveryState
	reason: string | null
}

export interface DeliveryPageRow extends DeliveryRow {
	cursor_moment: string
}

// datovy-model.md 4 „Doručení“
export interface DeliveryInstanceRow {
	id: string
	delivery_id: string
	artifact_id: string
	state: DeliveryInstanceState
	attempts: number
	last_dimse_status: string | null
	accepted_transfer_syntax: string | null
	retention_anchor: Date | null
	held_for_review_cause: HeldForReviewCause | null
	verification_rejections: number
	verification_on_hold_at: Date | null
	closed_from_state: ClosableDeliveryInstanceState | null
	closed_at: Date | null
	closed_by_user_id: string | null
	closure_reason: DeliveryClosureReason | null
}

// datovy-model.md 4 „Cíl doručení“
export interface DeliveryTargetRow {
	code: string
	state: DeliveryTargetState
	reason: string | null
	changed_at: Date
}

export interface DeliveryQuery {
	limit: number
	cursor: string | undefined
	state: DeliveryState | undefined
	instanceState: DeliveryInstanceState | undefined
}

export type DeliveryPage = MomentPage<DeliveryPageRow>
