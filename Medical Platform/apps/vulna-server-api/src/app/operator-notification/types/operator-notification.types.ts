import type { MobileContract, OperatorNotificationKind } from "@ansora/contracts"

type MobileSchemas = MobileContract.components["schemas"]

export type OperatorNotificationView = MobileSchemas["OperatorNotification"]
export type OperatorNotificationListView = MobileSchemas["OperatorNotificationList"]

export interface OperatorNotificationRow {
	id: string
	kind: OperatorNotificationKind
	created_at: Date
	acquisition_id: string | null
	discarded_count: number | null
	discarded_at: Date | null
}

export interface DiscardedDraftsNotification {
	userId: string
	consentId: string
	discardedCount: number
	discardedAt: Date
}
