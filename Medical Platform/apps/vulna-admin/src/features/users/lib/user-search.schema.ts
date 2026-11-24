import { USER_SEARCH_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

export const userSearchSchema = z.object({
	search: z
		.string()
		.trim()
		.max(USER_SEARCH_MAX_LENGTH, fillText(cs.errors.tooLong, { max: String(USER_SEARCH_MAX_LENGTH) })),
})

export type UserSearch = z.infer<typeof userSearchSchema>
