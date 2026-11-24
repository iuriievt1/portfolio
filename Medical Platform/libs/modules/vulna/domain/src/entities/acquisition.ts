import { ACQUISITION_KIND, type AcquisitionKind, MISSING_STEP, type MissingStep } from "@ansora/contracts"

const MILLISECONDS_PER_SECOND = 1000
const NO_FILES = 0

// datovy-model.md 4, CAP-015-R30, CAP-021-R25, CAP-023-R28
export const ACQUISITION_STATE = {
	DRAFT: "draft",
	RECEIVED: "received",
	ASSEMBLING: "assembling",
	DELIVERED: "delivered",
	FAILED: "failed",
	CLOSED_BY_ADMINISTRATOR: "closed_by_administrator",
} as const

export type AcquisitionState = (typeof ACQUISITION_STATE)[keyof typeof ACQUISITION_STATE]

export interface DraftProgress {
	kind: AcquisitionKind
	fileCount: number
	hasFinding: boolean
	hasBodySite: boolean
	hasWoundType: boolean
	hasHealingPhase: boolean
	hasDocumentTitle: boolean
}

// CAP-017-R16, CHG-181
export interface ClinicalSteps {
	woundType: boolean
	healingPhase: boolean
}

type StepCheck = readonly [isMissing: boolean, step: MissingStep]

function stepsOf(checks: readonly StepCheck[]): MissingStep[] {
	return checks.flatMap(([isMissing, step]) => (isMissing ? [step] : []))
}

// clinical-workflow.yaml MissingStep, CAP-021-R22, CAP-015-R31, CAP-017-R02, CAP-017-R16, CAP-018-R15
export function missingStepsOf(draft: DraftProgress, steps: ClinicalSteps): MissingStep[] {
	switch (draft.kind) {
		case ACQUISITION_KIND.PHOTO:
			return stepsOf([
				[draft.fileCount === NO_FILES, MISSING_STEP.IMAGES],
				[!draft.hasFinding, MISSING_STEP.FINDING],
				[!draft.hasBodySite, MISSING_STEP.BODY_SITE],
				[steps.woundType && draft.hasFinding && !draft.hasWoundType, MISSING_STEP.WOUND_TYPE],
				[steps.healingPhase && !draft.hasHealingPhase, MISSING_STEP.HEALING_PHASE],
			])
		case ACQUISITION_KIND.SCAN:
			return stepsOf([
				[draft.fileCount === NO_FILES, MISSING_STEP.PAGES],
				[!draft.hasDocumentTitle, MISSING_STEP.DOCUMENT_TITLE],
			])
		default:
			return draft.kind satisfies never
	}
}

// CAP-014-R22, CAP-015-R31, CAP-015-R35, CAP-015-R36, CAP-018-R15
export function nextMissingStepOf(
	draft: DraftProgress,
	steps: ClinicalSteps,
	unfinishedFileCount: number,
): MissingStep {
	const [first] = missingStepsOf(draft, steps)
	if (first !== undefined) {
		return first
	}
	return unfinishedFileCount > NO_FILES ? MISSING_STEP.FILES : MISSING_STEP.SUMMARY
}

// CAP-012-R31, CAP-015-R18
export function isReminderDue(updatedAt: Date, now: Date, reminderSeconds: number): boolean {
	return now.getTime() - updatedAt.getTime() >= reminderSeconds * MILLISECONDS_PER_SECOND
}
