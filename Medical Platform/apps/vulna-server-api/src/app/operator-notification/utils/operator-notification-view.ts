import type { OperatorNotificationRow, OperatorNotificationView } from "../types/operator-notification.types"

// clinical-workflow.yaml OperatorNotification, CAP-015-R20
export function operatorNotificationViewOf(row: OperatorNotificationRow): OperatorNotificationView {
	const view: OperatorNotificationView = {
		notification_id: row.id,
		kind: row.kind,
		created_at: row.created_at.toISOString(),
	}
	if (row.discarded_count !== null) {
		view.discarded_count = row.discarded_count
	}
	if (row.discarded_at !== null) {
		view.discarded_at = row.discarded_at.toISOString()
	}
	if (row.acquisition_id !== null) {
		view.acquisition_id = row.acquisition_id
	}
	return view
}
