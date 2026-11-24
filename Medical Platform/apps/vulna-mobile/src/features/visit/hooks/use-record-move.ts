import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { type AcquisitionAssignment, type AcquisitionDraft, acquisitionApi } from "../../../api/acquisitions"
import { errorCodeOf } from "../../../api/api-error"
import type { Encounter } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { randomUuid } from "../../../utils/random-uuid"
import { sessionCaller } from "../../session/session-actions"
import { cancelQueuedClosure } from "../../upload/closure-queue"
import type { RecordMove } from "../record-move"
import { isSamePatient, MOVE_TARGET, type MoveTarget } from "../record-move-text"

export const MOVE = {
	CHOOSING: "choosing",
	CONFIRMING: "confirming",
	MOVING: "moving",
	REFUSED: "refused",
	CHANGED: "changed",
	CLOSED: "closed",
	FAILED: "failed",
} as const

export const MOVE_REFUSAL = {
	OTHER_PATIENT: "other_patient",
	CLOSED_VISIT: "closed_visit",
} as const

export type MoveRefusal = (typeof MOVE_REFUSAL)[keyof typeof MOVE_REFUSAL]

export type MoveStep =
	| { kind: typeof MOVE.CHOOSING }
	| { kind: typeof MOVE.CONFIRMING; target: MoveTarget }
	| { kind: typeof MOVE.MOVING; target: MoveTarget }
	| { kind: typeof MOVE.REFUSED; refusal: MoveRefusal }
	| { kind: typeof MOVE.CHANGED }
	| { kind: typeof MOVE.CLOSED }
	| { kind: typeof MOVE.FAILED; failure: RemoteFailure }

const CHOOSING: MoveStep = { kind: MOVE.CHOOSING }

const CLOSED_VISIT_CODES: readonly string[] = [
	ERROR_CODE.ENCOUNTER_COMPLETED,
	ERROR_CODE.ENCOUNTER_CANCELLED,
	ERROR_CODE.ENCOUNTER_NOT_TODAY,
]

// CAP-014-R26, CAP-021-R32, CAP-014-S05, E25, E115, E118
function failureOf(error: unknown): MoveStep {
	const code = errorCodeOf(error)
	if (code === ERROR_CODE.PATIENT_MISMATCH) {
		return { kind: MOVE.REFUSED, refusal: MOVE_REFUSAL.OTHER_PATIENT }
	}
	if (code !== undefined && CLOSED_VISIT_CODES.includes(code)) {
		return { kind: MOVE.REFUSED, refusal: MOVE_REFUSAL.CLOSED_VISIT }
	}
	if (code === ERROR_CODE.ACQUISITION_VERSION_CONFLICT) {
		return { kind: MOVE.CHANGED }
	}
	if (code === ERROR_CODE.ACQUISITION_CLOSED) {
		return { kind: MOVE.CLOSED }
	}
	return { kind: MOVE.FAILED, failure: remoteFailureOf(error) }
}

// CAP-014-R06, CAP-014-R26, CAP-014-S46, clinical-workflow.yaml AcquisitionAssignment
function assignmentOf(draft: AcquisitionDraft, patient: Patient, target: MoveTarget): AcquisitionAssignment {
	const findingId = isSamePatient(draft, patient) ? (draft.finding_id ?? null) : null
	return target.kind === MOVE_TARGET.EXISTING
		? { patient_id: patient.patient_id, encounter_id: target.encounter.encounter_id, finding_id: findingId }
		: { patient_id: patient.patient_id, encounter_key: target.encounterKey, finding_id: findingId }
}

// CAP-014-R07, CAP-014-R25, CAP-002-R17
export function useRecordMove(move: RecordMove, patient: Patient, onMoved: (draft: AcquisitionDraft) => void) {
	const [step, setStep] = useState<MoveStep>(CHOOSING)
	const newVisitKey = useRef<string | undefined>(undefined)
	const busy = useRef(false)

	const chooseVisit = useCallback((encounter: Encounter) => {
		if (busy.current) {
			return
		}
		setStep({ kind: MOVE.CONFIRMING, target: { kind: MOVE_TARGET.EXISTING, encounter } })
	}, [])

	// CAP-014-R06
	const chooseNewVisit = useCallback(async () => {
		newVisitKey.current ??= await randomUuid()
		if (busy.current) {
			return
		}
		setStep({ kind: MOVE.CONFIRMING, target: { kind: MOVE_TARGET.NEW, encounterKey: newVisitKey.current } })
	}, [])

	const confirm = useCallback(async () => {
		if (step.kind !== MOVE.CONFIRMING || busy.current) {
			return
		}
		const { target } = step
		busy.current = true
		setStep({ kind: MOVE.MOVING, target })
		try {
			const moved = await sessionCaller.call((sessionToken) =>
				acquisitionApi.setAcquisitionAssignment(sessionToken, move.draft, assignmentOf(move.draft, patient, target)),
			)
			await cancelQueuedClosure(moved.acquisition_id)
			onMoved(moved)
		} catch (error) {
			setStep(error instanceof NoSessionError ? CHOOSING : failureOf(error))
		} finally {
			busy.current = false
		}
	}, [step, move, patient, onMoved])

	const dismiss = useCallback(() => setStep(CHOOSING), [])

	return { step, chooseVisit, chooseNewVisit, confirm, dismiss }
}
