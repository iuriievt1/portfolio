import { isDeliveryInstanceRetryable } from "@ansora/vulna-domain"
import type {
	DeliveryInstanceRow,
	DeliveryInstanceView,
	DeliveryRow,
	DeliveryTargetRow,
	DeliveryTargetView,
	DeliveryView,
} from "../types/delivery-monitoring.types"

// CAP-023-R28
function closureOf(row: DeliveryInstanceRow): DeliveryInstanceView["closure"] {
	if (
		row.closed_from_state === null ||
		row.closed_at === null ||
		row.closed_by_user_id === null ||
		row.closure_reason === null
	) {
		return null
	}
	return {
		reason: row.closure_reason,
		closed_from_state: row.closed_from_state,
		closed_at: row.closed_at.toISOString(),
		closed_by_user_id: row.closed_by_user_id,
		set_aside_data_deleted_at: null,
	}
}

// administration.yaml DeliveryInstance, CAP-023-R09, CAP-023-R15, CAP-023-R26, CAP-026-R03
export function deliveryInstanceViewOf(row: DeliveryInstanceRow): DeliveryInstanceView {
	return {
		instance_id: row.id,
		artifact_id: row.artifact_id,
		state: row.state,
		attempts: row.attempts,
		last_dimse_status: row.last_dimse_status,
		accepted_transfer_syntax: row.accepted_transfer_syntax,
		retention_anchor: row.retention_anchor?.toISOString() ?? null,
		is_retryable: isDeliveryInstanceRetryable(row.state),
		held_for_review_cause: row.held_for_review_cause,
		verification_rejections: row.verification_rejections,
		verification_on_hold_at: row.verification_on_hold_at?.toISOString() ?? null,
		closure: closureOf(row),
	}
}

// administration.yaml Delivery, CAP-021-R03, CAP-022-R11
export function deliveryViewOf(row: DeliveryRow, instances: readonly DeliveryInstanceRow[]): DeliveryView {
	return {
		delivery_id: row.id,
		acquisition_id: row.acquisition_id,
		acquisition_kind: row.acquisition_kind,
		acquisition_closed_at: row.acquisition_closed_at.toISOString(),
		target: row.target,
		state: row.state,
		reason: row.reason,
		instance: instances.map(deliveryInstanceViewOf),
	}
}

function instancesByDelivery(instances: readonly DeliveryInstanceRow[]): Map<string, DeliveryInstanceRow[]> {
	const grouped = new Map<string, DeliveryInstanceRow[]>()
	for (const instance of instances) {
		const own = grouped.get(instance.delivery_id) ?? []
		own.push(instance)
		grouped.set(instance.delivery_id, own)
	}
	return grouped
}

// administration.yaml DeliveriesPage
export function deliveryViewsOf(
	rows: readonly DeliveryRow[],
	instances: readonly DeliveryInstanceRow[],
): DeliveryView[] {
	const grouped = instancesByDelivery(instances)
	return rows.map((row) => deliveryViewOf(row, grouped.get(row.id) ?? []))
}

// administration.yaml DeliveryTarget, CAP-023-R23, CAP-023-R24
export function deliveryTargetViewOf(row: DeliveryTargetRow): DeliveryTargetView {
	return { code: row.code, state: row.state, reason: row.reason, changed_at: row.changed_at.toISOString() }
}
