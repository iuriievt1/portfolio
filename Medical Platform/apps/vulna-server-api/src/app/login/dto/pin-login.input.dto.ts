import { PERSONAL_NUMBER_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import type { PinLoginInput } from "../types/login.types"
import { signedBodySchema } from "./signed-body.input.dto"

export const pinLoginSchema = z.strictObject({
	personal_number: z.string().min(1).max(PERSONAL_NUMBER_MAX_LENGTH),
	proof: signedBodySchema,
}) satisfies z.ZodType<PinLoginInput>

export type PinLoginDto = PinLoginInput
