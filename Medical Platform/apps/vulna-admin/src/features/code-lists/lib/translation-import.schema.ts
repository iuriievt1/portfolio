import { LANGUAGE_CODE_PATTERN } from "@ansora/contracts"
import { z } from "zod"
import { configurationReasonSchema } from "@/features/configuration/lib/configuration-reason.schema"
import cs from "@/i18n/cs.json"

// CAP-017-R18, CAP-012-R18, administration.yaml CodeListTranslationImport
export const translationImportSchema = configurationReasonSchema.extend({
	language: z.string().trim().regex(LANGUAGE_CODE_PATTERN, cs.codeLists.import.errors.languageFormat),
})

export type TranslationImportValues = z.infer<typeof translationImportSchema>
