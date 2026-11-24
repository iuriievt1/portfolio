import { type AcquisitionKind, ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { type AcquisitionReceipt, acquisitionApi } from "../../../api/acquisitions"
import { errorCodeOf } from "../../../api/api-error"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { randomUuid } from "../../../utils/random-uuid"
import { effectiveConfiguration } from "../../session/effective-configuration-store"
import { sessionCaller } from "../../session/session-actions"
import { currentSession } from "../../session/session-store"
import type { OpenedVisit } from "../opened-visit"

export const DRAFT_CREATION = {
	IDLE: "idle",
	CREATING: "creating",
	LIMIT_REACHED: "limit_reached",
	VISIT_COMPLETED: "visit_completed",
	VISIT_CLOSED: "visit_closed",
	FAILED: "failed",
} as const

export const CLOSED_VISIT = {
	CANCELLED: "cancelled",
	EARLIER: "earlier",
} as const

export type ClosedVisit = (typeof CLOSED_VISIT)[keyof typeof CLOSED_VISIT]

export type DraftCreation =
	| { kind: typeof DRAFT_CREATION.IDLE }
	| { kind: typeof DRAFT_CREATION.CREATING }
	| { kind: typeof DRAFT_CREATION.LIMIT_REACHED; limit: number | undefined }
	| { kind: typeof DRAFT_CREATION.VISIT_COMPLETED }
	| { kind: typeof DRAFT_CREATION.VISIT_CLOSED; reason: ClosedVisit }
	| { kind: typeof DRAFT_CREATION.FAILED; failure: RemoteFailure }

const IDLE: DraftCreation = { kind: DRAFT_CREATION.IDLE }

// CAP-015-R18, CAP-015-S14, CAP-014-S32, CAP-014-S53, E56, E105, E121
function failureOf(error: unknown): DraftCreation {
	switch (errorCodeOf(error)) {
		case ERROR_CODE.DRAFT_LIMIT_REACHED:
			return { kind: DRAFT_CREATION.LIMIT_REACHED, limit: effectiveConfiguration()?.max_draft_acquisitions }
		case ERROR_CODE.ENCOUNTER_COMPLETED:
			return { kind: DRAFT_CREATION.VISIT_COMPLETED }
		case ERROR_CODE.ENCOUNTER_CANCELLED:
			return { kind: DRAFT_CREATION.VISIT_CLOSED, reason: CLOSED_VISIT.CANCELLED }
		case ERROR_CODE.ENCOUNTER_NOT_TODAY:
			return { kind: DRAFT_CREATION.VISIT_CLOSED, reason: CLOSED_VISIT.EARLIER }
		default:
			return { kind: DRAFT_CREATION.FAILED, failure: remoteFailureOf(error) }
	}
}

// CAP-015-R30, CAP-014-R06, CAP-021-R13, CAP-012-R19, CAP-002-R17
async function createDraft(visit: OpenedVisit, kind: AcquisitionKind): Promise<AcquisitionReceipt> {
	const session = currentSession()
	const configurationVersion = effectiveConfiguration()?.version
	if (session === undefined || configurationVersion === undefined) {
		throw new NoSessionError()
	}
	const idempotencyKey = await randomUuid()
	const visitPart =
		visit.encounterId === undefined ? { encounter_key: visit.encounterKey } : { encounter_id: visit.encounterId }
	return await sessionCaller.call((sessionToken) =>
		acquisitionApi.createAcquisitionDraft(
			sessionToken,
			{
				operator: { user_id: session.user.id, session_id: session.session_id },
				patient_id: visit.patient.patient_id,
				...visitPart,
				kind,
				started_at: new Date().toISOString(),
				configuration_version: configurationVersion,
			},
			idempotencyKey,
		),
	)
}

export function useDraftCreation(
	visit: OpenedVisit,
	onCreated: (receipt: AcquisitionReceipt, kind: AcquisitionKind) => void,
) {
	const [creation, setCreation] = useState<DraftCreation>(IDLE)
	const busy = useRef(false)

	const create = useCallback(
		async (kind: AcquisitionKind) => {
			if (busy.current) {
				return
			}
			busy.current = true
			setCreation({ kind: DRAFT_CREATION.CREATING })
			try {
				const receipt = await createDraft(visit, kind)
				setCreation(IDLE)
				onCreated(receipt, kind)
			} catch (error) {
				setCreation(error instanceof NoSessionError ? IDLE : failureOf(error))
			} finally {
				busy.current = false
			}
		},
		[visit, onCreated],
	)

	const dismiss = useCallback(() => setCreation(IDLE), [])

	return { creation, create, dismiss }
}
