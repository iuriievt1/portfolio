import { PAGE_LIMIT_MAX } from "@ansora/contracts"
import { z } from "zod"

const CURSOR_MAX_LENGTH = 4096

export const pageSchema = z.strictObject({
	limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).optional(),
	cursor: z.string().min(1).max(CURSOR_MAX_LENGTH).optional(),
})

export type PageInput = z.infer<typeof pageSchema>
