import { PATIENT_IDENTIFIER_VALUE_PATTERN, PATIENT_SEARCH_QUERY_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

// clinical-workflow.yaml findPatients
export const patientSearchSchema = z.strictObject({
	query: z.string().max(PATIENT_SEARCH_QUERY_MAX_LENGTH).regex(PATIENT_IDENTIFIER_VALUE_PATTERN),
})

export type PatientSearchInput = z.infer<typeof patientSearchSchema>
