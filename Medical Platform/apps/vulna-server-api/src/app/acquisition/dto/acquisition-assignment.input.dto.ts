import { z } from "zod"
import { ONE_ENCOUNTER_MESSAGE } from "../../encounter/constants/encounter.constants"
import { encounterKeySchema } from "../../encounter/dto/encounter.input.dto"
import { namesOneEncounter } from "../../encounter/utils/encounter-identity"

const VERSION_MAX_LENGTH = 32
const QUOTED_VERSION = /^"[0-9]+"$/
const QUOTE_LENGTH = 1

// clinical-workflow.yaml AcquisitionAssignment
export const acquisitionAssignmentSchema = z
	.strictObject({
		patient_id: z.uuid(),
		encounter_id: z.uuid().optional(),
		encounter_key: encounterKeySchema.optional(),
		finding_id: z.uuid().nullable().optional(),
	})
	.refine(namesOneEncounter, { message: ONE_ENCOUNTER_MESSAGE })

export type AcquisitionAssignmentInput = z.infer<typeof acquisitionAssignmentSchema>

// index.yaml AcquisitionVersion, CAP-021-R32
export const acquisitionVersionSchema = z
	.string()
	.max(VERSION_MAX_LENGTH)
	.regex(QUOTED_VERSION)
	.transform((value) => Number(value.slice(QUOTE_LENGTH, -QUOTE_LENGTH)))
	.pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER))

export const acquisitionIdSchema = z.uuid()
