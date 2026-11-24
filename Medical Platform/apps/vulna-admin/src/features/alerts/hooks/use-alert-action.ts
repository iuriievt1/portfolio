import { useCallback, useState } from "react"

export interface AlertAction {
	doneAlertIds: ReadonlySet<string>
	pendingAlertId: string | undefined
	failure: unknown
	run: (alertId: string, action: () => Promise<void>) => void
}

// CAP-021-R27, CAP-021-S25, CAP-023-R12
export function useAlertAction(isAlreadyDone: (error: unknown) => boolean): AlertAction {
	const [doneAlertIds, setDoneAlertIds] = useState<ReadonlySet<string>>(new Set())
	const [pendingAlertId, setPendingAlertId] = useState<string | undefined>(undefined)
	const [failure, setFailure] = useState<unknown>(undefined)

	const markDone = useCallback((alertId: string) => {
		setDoneAlertIds((current) => new Set(current).add(alertId))
	}, [])

	const run = useCallback(
		(alertId: string, action: () => Promise<void>) => {
			setPendingAlertId(alertId)
			setFailure(undefined)
			action()
				.then(() => markDone(alertId))
				.catch((error: unknown) => {
					if (isAlreadyDone(error)) {
						markDone(alertId)
						return
					}
					setFailure(error)
				})
				.finally(() => setPendingAlertId(undefined))
		},
		[isAlreadyDone, markDone],
	)

	return { doneAlertIds, pendingAlertId, failure, run }
}
