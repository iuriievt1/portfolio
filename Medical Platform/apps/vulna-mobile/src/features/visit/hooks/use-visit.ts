import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { errorCodeOf } from "../../../api/api-error"
import { type Encounter, type EncounterAcquisitionItem, encounterApi } from "../../../api/encounters"
import { readAllPages } from "../../../api/pages"
import { documentationFailureOf, type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { LOAD_STATE, type LoadState, useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"
import { useReloadAfterClosure } from "../../upload/hooks/use-reload-after-closure"
import type { OpenedVisit } from "../opened-visit"
import { ownDraftOf } from "../visit-view"

export interface VisitContent {
	encounter: Encounter | undefined
	records: readonly EncounterAcquisitionItem[]
}

export type VisitState = LoadState<VisitContent>

export const FINISH_STEP = {
	IDLE: "idle",
	CONFIRMING: "confirming",
	OWN_DRAFT: "own_draft",
	OTHERS_WORKING: "others_working",
	FINISHING: "finishing",
	FAILED: "failed",
} as const

export type FinishStep =
	| { kind: typeof FINISH_STEP.IDLE }
	| { kind: typeof FINISH_STEP.CONFIRMING }
	| { kind: typeof FINISH_STEP.OWN_DRAFT; draft: EncounterAcquisitionItem }
	| { kind: typeof FINISH_STEP.OTHERS_WORKING }
	| { kind: typeof FINISH_STEP.FINISHING }
	| { kind: typeof FINISH_STEP.FAILED; failure: RemoteFailure }

const IDLE: FinishStep = { kind: FINISH_STEP.IDLE }
const NEW_VISIT: VisitContent = { encounter: undefined, records: [] }

// CAP-014-R22, CAP-014-R20, CAP-019-R28
export function useVisit(visit: OpenedVisit) {
	const { encounterId } = visit
	const read = useCallback(async () => {
		if (encounterId === undefined) {
			return NEW_VISIT
		}
		return await sessionCaller.call((sessionToken) => readVisit(sessionToken, encounterId))
	}, [encounterId])
	// CAP-014-R29
	const { state, retry, reload, update } = useRemoteContent(read, { failureOf: documentationFailureOf })
	useReloadAfterClosure(reload)
	const [finish, setFinish] = useState<FinishStep>(IDLE)
	const busy = useRef(false)

	// CAP-014-S29, CAP-014-S30
	const askToFinish = useCallback(() => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		const draft = ownDraftOf(state.records)
		setFinish(draft === undefined ? { kind: FINISH_STEP.CONFIRMING } : { kind: FINISH_STEP.OWN_DRAFT, draft })
	}, [state])

	// CAP-014-S28, CAP-014-S34, CAP-014-S50
	const confirmFinish = useCallback(async () => {
		if (state.kind !== LOAD_STATE.READY || state.encounter === undefined || busy.current) {
			return
		}
		const { encounter, records } = state
		busy.current = true
		setFinish({ kind: FINISH_STEP.FINISHING })
		try {
			const finished = await sessionCaller.call((sessionToken) =>
				encounterApi.completeEncounter(sessionToken, encounter.encounter_id),
			)
			update({ encounter: finished })
			setFinish(IDLE)
		} catch (error) {
			setFinish(error instanceof NoSessionError ? IDLE : finishFailureOf(error, records))
		} finally {
			busy.current = false
		}
	}, [state, update])

	const dismissFinish = useCallback(() => setFinish(IDLE), [])

	return { state, finish, retry, askToFinish, confirmFinish, dismissFinish }
}

async function readVisit(sessionToken: string, encounterId: string): Promise<VisitContent> {
	let encounter: Encounter | undefined
	const records = await readAllPages(async (cursor) => {
		const page = await encounterApi.listEncounterAcquisitions(sessionToken, encounterId, cursor)
		encounter ??= page.encounter
		return page
	})
	return { encounter, records }
}

// CAP-014-R20, CAP-014-S34
function finishFailureOf(error: unknown, records: readonly EncounterAcquisitionItem[]): FinishStep {
	if (errorCodeOf(error) !== ERROR_CODE.ENCOUNTER_HAS_DRAFT) {
		return { kind: FINISH_STEP.FAILED, failure: remoteFailureOf(error) }
	}
	const draft = ownDraftOf(records)
	return draft === undefined ? { kind: FINISH_STEP.OTHERS_WORKING } : { kind: FINISH_STEP.OWN_DRAFT, draft }
}
