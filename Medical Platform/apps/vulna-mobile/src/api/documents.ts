import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type PatientDocumentItem = Schemas["PatientDocumentItem"]
type PatientDocumentsPage = Schemas["PatientDocumentsPage"]

const DOCUMENTS_PATH: keyof MobileContract.paths = "/documents"

export const documentApi = {
	// CAP-020-R18
	listPatientDocuments: (
		sessionToken: string,
		patientId: string,
		cursor: string | undefined,
	): Promise<PatientDocumentsPage> =>
		callApi<PatientDocumentsPage>(withQuery(DOCUMENTS_PATH, { patient_id: patientId, cursor }), { sessionToken }),
}
