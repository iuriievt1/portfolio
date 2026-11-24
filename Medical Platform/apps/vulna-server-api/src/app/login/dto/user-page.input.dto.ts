import { USER_SEARCH_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

export const userPageSchema = pageSchema.extend({
	search: z.string().trim().min(1).max(USER_SEARCH_MAX_LENGTH).optional(),
})

export type UserPageInput = z.infer<typeof userPageSchema>
