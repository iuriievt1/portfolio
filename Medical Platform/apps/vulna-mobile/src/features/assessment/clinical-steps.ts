import type { Texts } from "../../i18n/texts"
import type { EffectiveConfiguration } from "../session/effective-configuration-store"

export interface ClinicalSteps {
	woundType: boolean
	healingPhase: boolean
}

export const CAPTURE_STEP = {
	WOUND_TYPE: "wound_type",
	HEALING_PHASE: "healing_phase",
	SUMMARY: "summary",
} as const

export type CaptureStep = (typeof CAPTURE_STEP)[keyof typeof CAPTURE_STEP]

// CAP-017-R16
export function clinicalStepsOf(configuration: EffectiveConfiguration | undefined): ClinicalSteps {
	return {
		woundType: configuration?.wound_type_enabled === true,
		healingPhase: configuration?.healing_phase_enabled === true,
	}
}

// CAP-015-R31, CAP-017-R16
export function stepAfterLocation(isNewWound: boolean, steps: ClinicalSteps): CaptureStep {
	if (isNewWound && steps.woundType) {
		return CAPTURE_STEP.WOUND_TYPE
	}
	return stepAfterWoundType(steps)
}

// CAP-015-R31, CAP-017-R16
export function stepAfterWoundType(steps: ClinicalSteps): CaptureStep {
	return steps.healingPhase ? CAPTURE_STEP.HEALING_PHASE : CAPTURE_STEP.SUMMARY
}

// CAP-017-R16
export function assessmentEyebrowOf(steps: ClinicalSteps, typeAndPhase: string, texts: Texts): string | undefined {
	if (steps.woundType && steps.healingPhase) {
		return typeAndPhase
	}
	if (steps.woundType) {
		return texts.capture.woundType.title
	}
	return steps.healingPhase ? texts.capture.healingPhase.title : undefined
}
