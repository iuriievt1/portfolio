import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type Patient = Schemas["Patient"]
export type PatientSearchResult = Schemas["PatientSearchResult"]
export type PatientIdentification = Schemas["PatientIdentification"]
export type RecentPatientList = Schemas["RecentPatientList"]
export type RecentPatientItem = Schemas["RecentPatientItem"]
type PatientSearch = MobileContract.operations["findPatients"]["parameters"]["query"]

const PATIENTS_PATH: keyof MobileContract.paths = "/patients"
const IDENTIFICATION_PATH: keyof MobileContract.paths = "/patients/identification"
const RECENT_PATH: keyof MobileContract.paths = "/patients/recent"

// CAP-013-R07, CAP-013-R10, CAP-013-R17, CHG-175, CHG-176, CHG-182
export const patientApi = {
	identifyPatient: (sessionToken: string, identification: PatientIdentification): Promise<PatientSearchResult> =>
		callApi<PatientSearchResult>(IDENTIFICATION_PATH, { method: "POST", body: identification, sessionToken }),
	findPatients: (sessionToken: string, search: PatientSearch): Promise<PatientSearchResult> =>
		callApi<PatientSearchResult>(withQuery(PATIENTS_PATH, search), { sessionToken }),
	// clinical-workflow.yaml listRecentPatients, CAP-013-R19
	listRecentPatients: (sessionToken: string): Promise<RecentPatientList> =>
		callApi<RecentPatientList>(RECENT_PATH, { sessionToken }),
}
