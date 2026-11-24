import { LOGIN_START_REASON, type LoginStartReason, PERSONAL_NUMBER_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import type { OidcStartInput } from "../types/login.types"

const START_REASONS = Object.values(LOGIN_START_REASON) as [LoginStartReason, ...LoginStartReason[]]

export const oidcStartSchema = z.strictObject({
	expected_personal_number: z.string().trim().min(1).max(PERSONAL_NUMBER_MAX_LENGTH).optional(),
	reason: z.enum(START_REASONS).optional(),
}) satisfies z.ZodType<OidcStartInput>

export type OidcStartDto = OidcStartInput
