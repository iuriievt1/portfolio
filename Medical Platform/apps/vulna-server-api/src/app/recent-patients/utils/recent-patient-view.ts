import { patientViewOf } from "../../registry/utils/patient-view"
import type { RecentPatient, RecentPatientItemView } from "../types/recent-patients.types"

// clinical-workflow.yaml RecentPatientItem, CAP-013-R09
export function recentPatientViewOf(recent: RecentPatient): RecentPatientItemView {
	return { patient: patientViewOf(recent.patient), last_documented_at: recent.lastDocumentedAt.toISOString() }
}
