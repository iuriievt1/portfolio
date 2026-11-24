import { ADMINISTERED_ACQUISITION_STATES, type AdministeredAcquisitionState } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

const PATIENT_IDENTIFIER_MAX_LENGTH = 200

// administration.yaml searchAcquisitions, CAP-004-R10
export const acquisitionSearchSchema = pageSchema.extend({
	state: z
		.enum(ADMINISTERED_ACQUISITION_STATES as [AdministeredAcquisitionState, ...AdministeredAcquisitionState[]])
		.optional(),
	patient_identifier: z.string().trim().min(1).max(PATIENT_IDENTIFIER_MAX_LENGTH).optional(),
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
})

export type AcquisitionSearchInput = z.infer<typeof acquisitionSearchSchema>
