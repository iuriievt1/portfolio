import { z } from "zod"
import { STATE_MAX_LENGTH } from "../constants/login-input.constants"
import type { OidcCallbackInput } from "../types/login.types"

const PIN_PROOF_SETUP_MAX_LENGTH = 4096

export const oidcCallbackSchema = z.strictObject({
	state: z.string().min(1).max(STATE_MAX_LENGTH),
	completion_code: z.string().min(1).max(STATE_MAX_LENGTH),
	pin_proof_setup: z.string().min(1).max(PIN_PROOF_SETUP_MAX_LENGTH).optional(),
}) satisfies z.ZodType<OidcCallbackInput>

export type OidcCallbackDto = OidcCallbackInput
