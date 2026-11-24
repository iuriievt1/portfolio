import { z } from "zod"
import { STATE_MAX_LENGTH } from "../constants/login-input.constants"

const PROVIDER_VALUE_MAX_LENGTH = 4096

export const oidcReturnQuerySchema = z.object({
	state: z.string().min(1).max(STATE_MAX_LENGTH),
	code: z.string().min(1).max(PROVIDER_VALUE_MAX_LENGTH).optional(),
	error: z.string().min(1).max(PROVIDER_VALUE_MAX_LENGTH).optional(),
	error_description: z.string().max(PROVIDER_VALUE_MAX_LENGTH).optional(),
})

export type OidcReturnQueryDto = z.infer<typeof oidcReturnQuerySchema>
