import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { acquisitionApi } from "../../../api/acquisitions"
import { errorCodeOf } from "../../../api/api-error"
import type { EncounterAcquisitionItem } from "../../../api/encounters"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { sessionCaller } from "../../session/session-actions"
import type { OpenedVisit } from "../opened-visit"
import { beginRecordMove } from "../record-move"

export const MOVE_START = {
	IDLE: "idle",
	LOADING: "loading",
	CLOSED: "closed",
	FAILED: "failed",
} as const

export type MoveStart =
	| { kind: typeof MOVE_START.IDLE }
	| { kind: typeof MOVE_START.LOADING }
	| { kind: typeof MOVE_START.CLOSED }
	| { kind: typeof MOVE_START.FAILED; failure: RemoteFailure }

const IDLE: MoveStart = { kind: MOVE_START.IDLE }

// CAP-021-R32, E25
function failureOf(error: unknown): MoveStart {
	return errorCodeOf(error) === ERROR_CODE.ACQUISITION_CLOSED
		? { kind: MOVE_START.CLOSED }
		: { kind: MOVE_START.FAILED, failure: remoteFailureOf(error) }
}

// CAP-014-R25, CAP-021-R32, CAP-014-S05, E25
export function useMoveStart(visit: OpenedVisit, onReady: () => void) {
	const [moveStart, setMoveStart] = useState<MoveStart>(IDLE)
	const busy = useRef(false)

	const start = useCallback(
		async (record: EncounterAcquisitionItem) => {
			if (busy.current) {
				return
			}
			busy.current = true
			setMoveStart({ kind: MOVE_START.LOADING })
			try {
				const draft = await sessionCaller.call((sessionToken) =>
					acquisitionApi.getAcquisitionDraft(sessionToken, record.acquisition_id),
				)
				beginRecordMove({ source: visit, record, draft })
				setMoveStart(IDLE)
				onReady()
			} catch (error) {
				setMoveStart(error instanceof NoSessionError ? IDLE : failureOf(error))
			} finally {
				busy.current = false
			}
		},
		[visit, onReady],
	)

	const dismiss = useCallback(() => setMoveStart(IDLE), [])

	return { moveStart, start, dismiss }
}
