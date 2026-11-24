import { CONFIGURATION_KEY, type ConfigurationValues } from "@ansora/core-server"
import type { ClinicalSteps } from "@ansora/vulna-domain"

// CAP-017-R16, CHG-181
export function clinicalStepsOf(values: ConfigurationValues): ClinicalSteps {
	return {
		woundType: values.get(CONFIGURATION_KEY.ACQUISITION_WOUND_TYPE_ENABLED) === true,
		healingPhase: values.get(CONFIGURATION_KEY.ACQUISITION_HEALING_PHASE_ENABLED) === true,
	}
}
