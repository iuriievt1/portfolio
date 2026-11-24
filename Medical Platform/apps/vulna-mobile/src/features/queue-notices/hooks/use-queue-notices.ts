import type { QueueNotice } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { currentSession } from "../../session/session-store"
import { onQueueChange } from "../../upload/queue-changes"
import { acknowledgeLoss, acknowledgeNotice, noticesOf, unacknowledgedLossOf } from "../../upload/queue-notices"

// CAP-019-R25, CAP-019-R23, CAP-019-S10, CAP-019-S11, CAP-009-S05, Q-076, ia-navigace.md after-login
export function useQueueNotices() {
	const [notices, setNotices] = useState<readonly QueueNotice[]>([])
	const [lostAt, setLostAt] = useState<string | undefined>(undefined)

	useFocusEffect(
		useCallback(() => {
			let isShown = true
			const reread = () => {
				const userId = currentSession()?.user.id
				if (userId === undefined) {
					setNotices([])
					setLostAt(undefined)
					return
				}
				Promise.all([noticesOf(userId), unacknowledgedLossOf(userId)])
					.then(([list, lost]) => {
						if (isShown) {
							setNotices(list)
							setLostAt(lost)
						}
					})
					.catch((failure: unknown) => console.warn("the queue notices could not be read", failure))
			}
			reread()
			const stopListening = onQueueChange(reread)
			return () => {
				isShown = false
				stopListening()
			}
		}, []),
	)

	const acknowledge = useCallback((id: string) => {
		setNotices((current) => current.filter((notice) => notice.id !== id))
		acknowledgeNotice(id).catch((failure: unknown) =>
			console.warn(`queue notice ${id} could not be acknowledged`, failure),
		)
	}, [])

	// CAP-009-S05, Q-076
	const acknowledgeLostQueue = useCallback(() => {
		const userId = currentSession()?.user.id
		if (lostAt === undefined || userId === undefined) {
			return
		}
		setLostAt(undefined)
		acknowledgeLoss(lostAt, userId).catch((failure: unknown) =>
			console.warn("the lost queue could not be acknowledged", failure),
		)
	}, [lostAt])

	return { current: notices[0], lostAt, acknowledge, acknowledgeLostQueue }
}
