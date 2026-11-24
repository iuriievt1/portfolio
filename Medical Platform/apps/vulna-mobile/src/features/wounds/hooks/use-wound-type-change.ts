import { ERROR_CODE } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { errorCodeOf } from "../../../api/api-error"
import { findingApi } from "../../../api/findings"
import { documentationFailureOf } from "../../../api/remote-failure"
import { sessionCaller } from "../../session/session-actions"
import { noteFindingChange } from "../finding-changes"
import {
	type ChosenChange,
	closesOnDismiss,
	IDLE,
	stepAfterConflict,
	TYPE_CHANGE,
	type TypeChangeStep,
} from "../type-change"

interface ChangeTarget {
	findingId: string
	current: string
}

// CAP-020-R21, CAP-020-S26, CAP-025-R30, E122
export function useWoundTypeChange({ findingId, current }: ChangeTarget, onClose: () => void) {
	const [known, setKnown] = useState(current)
	const [step, setStep] = useState<TypeChangeStep>(IDLE)
	const busy = useRef(false)

	const choose = useCallback(
		(code: string, version: string) => {
			if (code === known) {
				onClose()
				return
			}
			setStep({ kind: TYPE_CHANGE.CONFIRMING, previous: known, next: code, version, hasChangedMeanwhile: false })
		},
		[known, onClose],
	)

	// mobile/clinical-workflow.yaml changeFindingWoundType 409
	const reconfirm = useCallback(
		async (change: ChosenChange) => {
			try {
				const page = await sessionCaller.call((sessionToken) =>
					findingApi.getFindingHistory(sessionToken, findingId, undefined),
				)
				const next = stepAfterConflict(change, page.wound_type_code ?? undefined)
				if (next.kind === TYPE_CHANGE.IDLE) {
					noteFindingChange()
					onClose()
					return
				}
				if (next.kind === TYPE_CHANGE.CONFIRMING) {
					setKnown(next.previous)
				}
				setStep(next)
			} catch (error) {
				setStep(failedStepOf(error))
			}
		},
		[findingId, onClose],
	)

	// CAP-020-R21, CAP-021-R29
	const confirm = useCallback(async () => {
		if (step.kind !== TYPE_CHANGE.CONFIRMING || busy.current) {
			return
		}
		const change: ChosenChange = { previous: step.previous, next: step.next, version: step.version }
		busy.current = true
		setStep({ kind: TYPE_CHANGE.CHANGING, ...change })
		try {
			await sessionCaller.call((sessionToken) =>
				findingApi.changeFindingWoundType(sessionToken, findingId, {
					wound_type_code: change.next,
					code_list_version: change.version,
					previous_wound_type_code: change.previous,
				}),
			)
			noteFindingChange()
			setStep(IDLE)
			onClose()
		} catch (error) {
			if (errorCodeOf(error) === ERROR_CODE.FINDING_WOUND_TYPE_CONFLICT) {
				await reconfirm(change)
				return
			}
			setStep(failedStepOf(error))
		} finally {
			busy.current = false
		}
	}, [step, findingId, onClose, reconfirm])

	// CAP-020-S03, E29
	const dismiss = useCallback(() => {
		if (closesOnDismiss(step)) {
			noteFindingChange()
			onClose()
		}
		setStep(IDLE)
	}, [step, onClose])

	return { known, step, choose, confirm, dismiss }
}

// CAP-002-R17, E29
function failedStepOf(error: unknown): TypeChangeStep {
	return error instanceof NoSessionError ? IDLE : { kind: TYPE_CHANGE.FAILED, failure: documentationFailureOf(error) }
}
