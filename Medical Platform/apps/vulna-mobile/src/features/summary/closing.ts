import { ACQUISITION_KIND, ERROR_CODE, MISSING_STEP, type MissingStep } from "@ansora/contracts"
import {
	type BufferedFile,
	type QueuedClosure,
	RECORD_FILES,
	type RecordFiles,
	recordFilesStateOf,
} from "@ansora/core-mobile"
import type { AcquisitionClosure, AcquisitionDraft } from "../../api/acquisitions"
import { ApiProblemError, isNoConnection } from "../../api/api-error"
import { HTTP_STATUS } from "../../api/http-status"
import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import type { ClinicalSteps } from "../assessment/clinical-steps"
import { isKeyOrderKept, keysInSequence } from "../upload/draft-files"

// Figma 05 H
export const RESPONSE_TIME_MS = 15_000

export const CLOSING = {
	IDLE: "idle",
	CLOSING: "closing",
	QUEUED: "queued",
	NO_RESPONSE: "no_response",
	DOCUMENTATION_UNAVAILABLE: "documentation_unavailable",
	REJECTED: "rejected",
	UNREADABLE: "unreadable",
	CHANGED: "changed",
	OTHER_DEVICE: "other_device",
	MISSING: "missing",
	CLOSED: "closed",
} as const

export type ClosingState =
	| { kind: typeof CLOSING.IDLE }
	| { kind: typeof CLOSING.CLOSING }
	| { kind: typeof CLOSING.QUEUED; remaining: number }
	| { kind: typeof CLOSING.NO_RESPONSE }
	| { kind: typeof CLOSING.DOCUMENTATION_UNAVAILABLE }
	| { kind: typeof CLOSING.REJECTED }
	| { kind: typeof CLOSING.UNREADABLE }
	| { kind: typeof CLOSING.CHANGED }
	| { kind: typeof CLOSING.OTHER_DEVICE }
	| { kind: typeof CLOSING.MISSING; steps: readonly MissingStep[] }
	| { kind: typeof CLOSING.CLOSED }

// CAP-019-R29, CAP-019-R02, E70, E93
export const TO_QUEUE = { kind: "to_queue" } as const
export const MISSING_UNNAMED = { kind: "missing_unnamed" } as const

type ClosingStep = ClosingState | typeof TO_QUEUE | typeof MISSING_UNNAMED

export const CLOSING_STATE = {
	IDLE: { kind: CLOSING.IDLE },
	CLOSING: { kind: CLOSING.CLOSING },
	NO_RESPONSE: { kind: CLOSING.NO_RESPONSE },
	DOCUMENTATION_UNAVAILABLE: { kind: CLOSING.DOCUMENTATION_UNAVAILABLE },
	REJECTED: { kind: CLOSING.REJECTED },
	UNREADABLE: { kind: CLOSING.UNREADABLE },
	CHANGED: { kind: CLOSING.CHANGED },
	OTHER_DEVICE: { kind: CLOSING.OTHER_DEVICE },
	CLOSED: { kind: CLOSING.CLOSED },
} as const satisfies Record<string, ClosingState>

const KNOWN_STEPS: readonly string[] = Object.values(MISSING_STEP)

export class NoResponseError extends Error {
	constructor() {
		super("The server did not answer in time")
		this.name = "NoResponseError"
	}
}

interface ClosingOperator {
	userId: string
	sessionId: string
}

interface CompletenessSource {
	draft: AcquisitionDraft
	fileCount: number
	isNewWound: boolean
	steps: ClinicalSteps
}

// CAP-015-R31, CAP-021-R22, CAP-018-R15, CAP-017-R16, E107
export function missingStepsOf({ draft, fileCount, isNewWound, steps }: CompletenessSource): MissingStep[] {
	if (draft.kind === ACQUISITION_KIND.SCAN) {
		return [
			...(fileCount === 0 ? [MISSING_STEP.PAGES] : []),
			...(draft.document_title === undefined ? [MISSING_STEP.DOCUMENT_TITLE] : []),
		]
	}
	const hasFinding = draft.finding_id !== null && draft.finding_id !== undefined
	const hasWoundType = draft.wound_type_code !== null && draft.wound_type_code !== undefined
	const hasHealingPhase = draft.assessment?.healing_phase_code !== undefined
	return [
		...(fileCount === 0 ? [MISSING_STEP.IMAGES] : []),
		...(hasFinding && draft.body_site !== undefined ? [] : [MISSING_STEP.BODY_SITE]),
		...(steps.woundType && isNewWound && !hasWoundType ? [MISSING_STEP.WOUND_TYPE] : []),
		...(steps.healingPhase && !hasHealingPhase ? [MISSING_STEP.HEALING_PHASE] : []),
	]
}

// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-009-S05, Q-076
export const CLOSURE_CHECK = {
	READY: "ready",
	WAIT: "wait",
	REJECTED: "rejected",
	UNREADABLE: "unreadable",
	ON_OTHER_DEVICE: "on_other_device",
	CHANGED: "changed",
} as const

export type ClosureCheck = (typeof CLOSURE_CHECK)[keyof typeof CLOSURE_CHECK]

type ConfirmedRecord = Pick<QueuedClosure, "fileKeys" | "contentFingerprint">

// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-015-R35, CAP-015-R36, CAP-018-S10, CAP-009-S05, E111, E112, E115, Q-076
export function closureCheckOf(
	confirmed: ConfirmedRecord,
	fresh: AcquisitionDraft,
	freshFingerprint: string,
	local: readonly BufferedFile[],
): ClosureCheck {
	const filesCheck = filesCheckOf(recordFilesStateOf(confirmed.fileKeys, local, fresh.files))
	if (filesCheck !== undefined) {
		return filesCheck
	}
	const isSameContent = freshFingerprint === confirmed.contentFingerprint
	const isSameOrder = isKeyOrderKept(confirmed.fileKeys, keysInSequence(fresh.files))
	return isSameContent && isSameOrder ? CLOSURE_CHECK.READY : CLOSURE_CHECK.CHANGED
}

// CAP-021-R25, CAP-015-R35, CAP-015-R36, CAP-009-S05, Q-076
function filesCheckOf(files: RecordFiles): ClosureCheck | undefined {
	switch (files) {
		case RECORD_FILES.REJECTED:
			return CLOSURE_CHECK.REJECTED
		case RECORD_FILES.UNREADABLE:
			return CLOSURE_CHECK.UNREADABLE
		case RECORD_FILES.ON_OTHER_DEVICE:
			return CLOSURE_CHECK.ON_OTHER_DEVICE
		case RECORD_FILES.CHANGED:
			return CLOSURE_CHECK.CHANGED
		case RECORD_FILES.UPLOADING:
			return CLOSURE_CHECK.WAIT
		case RECORD_FILES.COMPLETE:
			return undefined
		default:
			return files satisfies never
	}
}

// CAP-014-R14, CAP-021-R13, CAP-021-R25
export function closureOf(
	confirmedFileCount: number,
	operator: ClosingOperator,
	completedAt: Date,
): AcquisitionClosure {
	return {
		file_count: confirmedFileCount,
		completed_at: completedAt.toISOString(),
		operator: { user_id: operator.userId, session_id: operator.sessionId },
	}
}

// Figma 05 H.3
export function withinResponseTime<T>(work: Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new NoResponseError()), RESPONSE_TIME_MS)
		work.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error: unknown) => {
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}

// E107, CAP-021-R22, CAP-019-R27
function missingStepsOfProblem(steps: readonly string[]): MissingStep[] {
	const known = steps.filter((step): step is MissingStep => KNOWN_STEPS.includes(step))
	return known.length === 0 ? [MISSING_STEP.SUMMARY] : known
}

// CAP-021-R25, CAP-021-R32, CAP-019-R02, CAP-019-R29, ADR-054, E70, E93, E107, E115, E129, Figma 05 H
export function closingFailureOf(error: unknown): ClosingStep {
	if (error instanceof NoResponseError) {
		return CLOSING_STATE.NO_RESPONSE
	}
	if (!(error instanceof ApiProblemError)) {
		return isNoConnection(error) ? TO_QUEUE : CLOSING_STATE.NO_RESPONSE
	}
	switch (error.code) {
		case ERROR_CODE.ACQUISITION_CLOSED:
			return CLOSING_STATE.CLOSED
		case ERROR_CODE.ACQUISITION_VERSION_CONFLICT:
		case ERROR_CODE.RESOURCE_NOT_FOUND:
		case ERROR_CODE.ACQUISITION_INCOMPLETE:
			return CLOSING_STATE.CHANGED
		case ERROR_CODE.RECORD_REJECTED:
			return error.missingSteps === undefined || error.missingSteps.length === 0
				? MISSING_UNNAMED
				: { kind: CLOSING.MISSING, steps: missingStepsOfProblem(error.missingSteps) }
		case ERROR_CODE.DOCUMENTATION_UNAVAILABLE:
			return CLOSING_STATE.DOCUMENTATION_UNAVAILABLE
		case ERROR_CODE.SIGN_IN_AGAIN:
			return CLOSING_STATE.IDLE
		default:
			return error.status === HTTP_STATUS.UNAUTHORIZED ? CLOSING_STATE.IDLE : CLOSING_STATE.NO_RESPONSE
	}
}

// CAP-019-R29, E70, E93
export function queuedClosingTextOf(remaining: number, texts: Texts): string {
	const queued = texts.capture.closing.queued
	return remaining === 0 ? queued.bodyOffline : fillText(queued.body, { n: remaining }, texts.language)
}

// E107
export function missingStepsTextOf(steps: readonly MissingStep[], texts: Texts): string {
	const names = texts.capture.closing.missing.steps
	const parts = steps.map((step) => {
		switch (step) {
			case MISSING_STEP.FINDING:
			case MISSING_STEP.BODY_SITE:
				return names.bodySite
			case MISSING_STEP.WOUND_TYPE:
				return names.woundType
			case MISSING_STEP.HEALING_PHASE:
				return names.healingPhase
			case MISSING_STEP.DOCUMENT_TITLE:
				return names.documentTitle
			case MISSING_STEP.IMAGES:
			case MISSING_STEP.FILES:
				return names.images
			case MISSING_STEP.PAGES:
				return names.pages
			default:
				return names.other
		}
	})
	const list = [...new Set(parts)].join(texts.capture.closing.missing.separator)
	return fillText(texts.capture.closing.missing.body, { missing: list }, texts.language)
}
