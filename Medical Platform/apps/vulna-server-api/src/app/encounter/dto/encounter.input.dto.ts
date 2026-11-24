import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

// clinical-workflow.yaml listPatientEncounters
export const patientEncountersQuerySchema = pageSchema.extend({
	patient_id: z.uuid(),
	date: z.iso.date().optional(),
})

export type PatientEncountersQuery = z.infer<typeof patientEncountersQuerySchema>

// clinical-workflow.yaml listScheduledEncounters
export const scheduledEncountersQuerySchema = z.strictObject({
	date: z.iso.date(),
})

export type ScheduledEncountersQuery = z.infer<typeof scheduledEncountersQuerySchema>

export const encounterIdSchema = z.uuid()

// CAP-014-R06
export const encounterKeySchema = z.uuid().transform((key) => key.toLowerCase())
