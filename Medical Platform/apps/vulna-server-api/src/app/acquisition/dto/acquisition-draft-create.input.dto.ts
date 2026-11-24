import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { z } from "zod"
import { ONE_ENCOUNTER_MESSAGE } from "../../encounter/constants/encounter.constants"
import { encounterKeySchema } from "../../encounter/dto/encounter.input.dto"
import { namesOneEncounter } from "../../encounter/utils/encounter-identity"

const operatorSchema = z.strictObject({
	user_id: z.uuid(),
	session_id: z.uuid(),
})

// clinical-workflow.yaml AcquisitionDraftCreate
export const acquisitionDraftCreateSchema = z
	.strictObject({
		operator: operatorSchema,
		patient_id: z.uuid(),
		encounter_id: z.uuid().optional(),
		encounter_key: encounterKeySchema.optional(),
		kind: z.enum(Object.values(ACQUISITION_KIND) as [AcquisitionKind, ...AcquisitionKind[]]),
		started_at: z.iso.datetime({ offset: true }),
		configuration_version: z.number().int().min(1),
	})
	.refine(namesOneEncounter, { message: ONE_ENCOUNTER_MESSAGE })

export type AcquisitionDraftCreateInput = z.infer<typeof acquisitionDraftCreateSchema>

// CAP-021-R08
export const idempotencyKeySchema = z.uuid()
