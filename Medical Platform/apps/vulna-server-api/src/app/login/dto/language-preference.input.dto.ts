import { LANGUAGE_CODE_MAX_LENGTH, LANGUAGE_CODE_MIN_LENGTH, LANGUAGE_CODE_PATTERN } from "@ansora/contracts"
import { z } from "zod"
import type { LanguagePreferenceInput } from "../types/language-preference.types"

export const languagePreferenceSchema = z.strictObject({
	language: z.string().trim().min(LANGUAGE_CODE_MIN_LENGTH).max(LANGUAGE_CODE_MAX_LENGTH).regex(LANGUAGE_CODE_PATTERN),
}) satisfies z.ZodType<LanguagePreferenceInput>
