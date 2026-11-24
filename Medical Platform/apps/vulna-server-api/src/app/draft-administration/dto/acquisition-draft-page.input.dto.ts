import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

// administration.yaml searchAcquisitionDrafts, CAP-004-R14
export const acquisitionDraftPageSchema = pageSchema.extend({
	operator_user_id: z.uuid().optional(),
	not_updated_since: z.iso.datetime({ offset: true }).optional(),
})

export type AcquisitionDraftPageInput = z.infer<typeof acquisitionDraftPageSchema>
