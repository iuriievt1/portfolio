import { effectiveConfiguration } from "../session/effective-configuration-store"
import { type ClinicalSteps, clinicalStepsOf } from "./clinical-steps"

// CAP-017-R16
export function clinicalSteps(): ClinicalSteps {
	return clinicalStepsOf(effectiveConfiguration())
}
