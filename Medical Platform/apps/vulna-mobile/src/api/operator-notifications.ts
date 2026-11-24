import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"

type Schemas = MobileContract.components["schemas"]

export type OperatorNotification = Schemas["OperatorNotification"]
type OperatorNotificationList = Schemas["OperatorNotificationList"]

const NOTIFICATIONS_PATH: keyof MobileContract.paths = "/operator-notifications"

export const operatorNotificationApi = {
	// CAP-015-R18, CAP-015-R20, CAP-026-R16
	listOperatorNotifications: (sessionToken: string): Promise<OperatorNotificationList> =>
		callApi<OperatorNotificationList>(NOTIFICATIONS_PATH, { sessionToken }),
	// CAP-015-R20
	acknowledgeOperatorNotification: (sessionToken: string, notificationId: string): Promise<void> =>
		callApi<void>(`${NOTIFICATIONS_PATH}/${encodeURIComponent(notificationId)}/acknowledgement`, {
			method: "POST",
			sessionToken,
		}),
}
