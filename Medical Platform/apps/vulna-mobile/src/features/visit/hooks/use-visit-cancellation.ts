import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { errorCodeOf } from "../../../api/api-error"
import { encounterApi } from "../../../api/encounters"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { sessionCaller } from "../../session/session-actions"

export const CANCELLATION = {
	IDLE: "idle",
	CONFIRMING: "confirming",
	CANCELLING: "cancelling",
	REFUSED: "refused",
	FAILED: "failed",
} as const

export const CANCELLATION_REFUSAL = {
	CLOSED_RECORD: "closed_record",
	COMPLETED: "completed",
} as const

export type CancellationRefusal = (typeof CANCELLATION_REFUSAL)[keyof typeof CANCELLATION_REFUSAL]

export type Cancellation =
	| { kind: typeof CANCELLATION.IDLE }
	| { kind: typeof CANCELLATION.CONFIRMING }
	| { kind: typeof CANCELLATION.CANCELLING }
	| { kind: typeof CANCELLATION.REFUSED; refusal: CancellationRefusal }
	| { kind: typeof CANCELLATION.FAILED; failure: RemoteFailure }

const IDLE: Cancellation = { kind: CANCELLATION.IDLE }

// Q-150
function failureOf(error: unknown): Cancellation {
	switch (errorCodeOf(error)) {
		case ERROR_CODE.ENCOUNTER_HAS_CLOSED_RECORD:
			return { kind: CANCELLATION.REFUSED, refusal: CANCELLATION_REFUSAL.CLOSED_RECORD }
		case ERROR_CODE.ENCOUNTER_COMPLETED:
			return { kind: CANCELLATION.REFUSED, refusal: CANCELLATION_REFUSAL.COMPLETED }
		default:
			return { kind: CANCELLATION.FAILED, failure: remoteFailureOf(error) }
	}
}

// Q-150, CAP-014-R29, CAP-002-R17
export function useVisitCancellation(encounterId: string | undefined, onCancelled: () => void) {
	const [cancellation, setCancellation] = useState<Cancellation>(IDLE)
	const busy = useRef(false)

	const ask = useCallback(() => {
		if (busy.current) {
			return
		}
		setCancellation({ kind: CANCELLATION.CONFIRMING })
	}, [])

	const confirm = useCallback(async () => {
		if (encounterId === undefined || busy.current) {
			return
		}
		busy.current = true
		setCancellation({ kind: CANCELLATION.CANCELLING })
		try {
			await sessionCaller.call((sessionToken) => encounterApi.cancelEncounter(sessionToken, encounterId))
			setCancellation(IDLE)
			onCancelled()
		} catch (error) {
			setCancellation(error instanceof NoSessionError ? IDLE : failureOf(error))
		} finally {
			busy.current = false
		}
	}, [encounterId, onCancelled])

	const dismiss = useCallback(() => setCancellation(IDLE), [])

	return { cancellation, ask, confirm, dismiss }
}
