import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

// clinical-workflow.yaml listPatientDocuments
export const patientDocumentsSchema = pageSchema.extend({
	patient_id: z.uuid(),
})

export type PatientDocumentsInput = z.infer<typeof patientDocumentsSchema>
