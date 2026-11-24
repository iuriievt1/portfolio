import { codeListSetVersionText } from "@ansora/core-server"
import type { AssessmentFields, AssessmentView } from "../types/finding.types"

// clinical-workflow.yaml Assessment, CAP-017-R03, CAP-017-R04, CAP-017-R09, CAP-017-R16
export function assessmentViewOf(assessment: AssessmentFields): AssessmentView {
	const view: AssessmentView = {}
	if (assessment.healing_phase_code !== null && assessment.code_list_version !== null) {
		view.healing_phase_code = assessment.healing_phase_code
		view.code_list_version = codeListSetVersionText(assessment.code_list_version)
	}
	if (assessment.description !== null) {
		view.description = assessment.description
	}
	return view
}
