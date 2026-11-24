import type { AdministrationContract } from "@ansora/contracts"
import { z } from "zod"

export type CardBindingCodeInput = AdministrationContract.components["schemas"]["CardBindingCodeRequest"]

const NOTE_MAX_LENGTH = 500

export const cardBindingCodeSchema = z
	.strictObject({ note: z.string().max(NOTE_MAX_LENGTH).optional() })
	.optional() satisfies z.ZodType<CardBindingCodeInput | undefined>
