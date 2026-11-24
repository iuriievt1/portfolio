import {
	PATIENT_IDENTIFICATION_METHOD,
	PATIENT_IDENTIFIER_VALUE_MAX_LENGTH,
	PATIENT_IDENTIFIER_VALUE_PATTERN,
	type PatientIdentificationMethod,
} from "@ansora/contracts"
import { z } from "zod"
import { PATIENT_IDENTIFIER_SYSTEM_MAX_LENGTH } from "../constants/registry.constants"

// clinical-workflow.yaml identifyPatient, PatientIdentification
export const patientIdentificationSchema = z.strictObject({
	search_method: z.enum(
		Object.values(PATIENT_IDENTIFICATION_METHOD) as [PatientIdentificationMethod, ...PatientIdentificationMethod[]],
	),
	system: z.string().trim().min(1).max(PATIENT_IDENTIFIER_SYSTEM_MAX_LENGTH),
	// CAP-013-R10, CAP-013-S21
	value: z.string().trim().max(PATIENT_IDENTIFIER_VALUE_MAX_LENGTH).regex(PATIENT_IDENTIFIER_VALUE_PATTERN),
})

export type PatientIdentificationInput = z.infer<typeof patientIdentificationSchema>
