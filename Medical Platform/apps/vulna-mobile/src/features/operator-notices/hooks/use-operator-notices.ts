import { NoSessionError } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { type OperatorNotification, operatorNotificationApi } from "../../../api/operator-notifications"
import { sessionCaller } from "../../session/session-actions"
import { currentSession } from "../../session/session-store"

let checkedSessionId: string | undefined

function warnUnlessSignedOut(message: string, error: unknown): void {
	if (!(error instanceof NoSessionError)) {
		console.warn(message, error)
	}
}

// CAP-015-R18, CAP-015-R20, CAP-015-S23, CAP-015-S43, ia-navigace.md after-login
export function useOperatorNotices() {
	const [pending, setPending] = useState<readonly OperatorNotification[]>([])
	const [isAcknowledging, setAcknowledging] = useState(false)

	useFocusEffect(
		useCallback(() => {
			const sessionId = currentSession()?.session_id
			if (sessionId === undefined || sessionId === checkedSessionId) {
				return
			}
			let isShown = true
			sessionCaller
				.call((sessionToken) => operatorNotificationApi.listOperatorNotifications(sessionToken))
				.then((list) => {
					if (isShown) {
						checkedSessionId = sessionId
						setPending(list.items)
					}
				})
				.catch((error: unknown) => warnUnlessSignedOut("operator notifications could not be read", error))
			return () => {
				isShown = false
			}
		}, []),
	)

	const acknowledge = useCallback(async (notificationId: string) => {
		setAcknowledging(true)
		try {
			await sessionCaller.call((sessionToken) =>
				operatorNotificationApi.acknowledgeOperatorNotification(sessionToken, notificationId),
			)
		} catch (error) {
			warnUnlessSignedOut(`operator notification ${notificationId} could not be acknowledged`, error)
		} finally {
			setAcknowledging(false)
			setPending((current) => current.filter((notification) => notification.notification_id !== notificationId))
		}
	}, [])

	return { current: pending[0], isAcknowledging, acknowledge }
}
