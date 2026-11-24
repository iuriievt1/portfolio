import { MISSING_STEP, type MissingStep } from "@ansora/contracts"

export const WOUND_STEP = {
	LOCATION: "location",
	ASSESSMENT: "assessment",
} as const

export type WoundStep = (typeof WOUND_STEP)[keyof typeof WOUND_STEP]

const WOUND_STEP_OF = new Map<MissingStep, WoundStep>([
	[MISSING_STEP.FINDING, WOUND_STEP.LOCATION],
	[MISSING_STEP.BODY_SITE, WOUND_STEP.LOCATION],
	[MISSING_STEP.WOUND_TYPE, WOUND_STEP.ASSESSMENT],
	[MISSING_STEP.HEALING_PHASE, WOUND_STEP.ASSESSMENT],
])

// E107, CAP-015-R31
export function firstWoundStepOf(steps: readonly MissingStep[]): WoundStep | undefined {
	return steps.map((step) => WOUND_STEP_OF.get(step)).find((woundStep) => woundStep !== undefined)
}
