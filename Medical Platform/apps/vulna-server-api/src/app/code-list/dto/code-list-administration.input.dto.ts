import {
	CODE_LIST_ITEM_CODE_MAX_LENGTH,
	CODE_LIST_ITEM_CODE_PATTERN,
	CODE_LIST_ITEM_NAME_MAX_LENGTH,
	CODE_LIST_ITEM_NAME_PATTERN,
	CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS,
	CONFIGURATION_REASON_MAX_LENGTH,
	LANGUAGE_CODE_MAX_LENGTH,
	LANGUAGE_CODE_MIN_LENGTH,
	LANGUAGE_CODE_PATTERN,
} from "@ansora/contracts"
import { z } from "zod"
import {
	CODE_LIST_CODE_MAX_LENGTH,
	CODE_LIST_ITEM_SEQUENCE_MAX,
	CODE_LIST_ITEM_SEQUENCE_MIN,
	CODE_LIST_ITEMS_MAX,
} from "../constants/code-list.constants"

const languageCode = z
	.string()
	.trim()
	.min(LANGUAGE_CODE_MIN_LENGTH)
	.max(LANGUAGE_CODE_MAX_LENGTH)
	.regex(LANGUAGE_CODE_PATTERN)
const itemCode = z.string().trim().max(CODE_LIST_ITEM_CODE_MAX_LENGTH).regex(CODE_LIST_ITEM_CODE_PATTERN)

// administration.yaml listCodeListItems, setCodeListItems
export const codeListCodeSchema = z.string().trim().min(1).max(CODE_LIST_CODE_MAX_LENGTH)

function hasDistinctLanguages(names: Readonly<Record<string, unknown>> | undefined): boolean {
	const languages = Object.keys(names ?? {}).map((language) => language.toLowerCase())
	return new Set(languages).size === languages.length
}

// administration.yaml CodeListItem, CAP-017-R08, CAP-017-R18
const codeListItemSchema = z
	.strictObject({
		code: itemCode,
		name: z.string().max(CODE_LIST_ITEM_NAME_MAX_LENGTH).regex(CODE_LIST_ITEM_NAME_PATTERN),
		names: z
			.record(
				languageCode,
				z.string().trim().min(1).max(CODE_LIST_ITEM_NAME_MAX_LENGTH).regex(CODE_LIST_ITEM_NAME_PATTERN).nullable(),
			)
			.optional(),
		sequence: z.number().int().min(CODE_LIST_ITEM_SEQUENCE_MIN).max(CODE_LIST_ITEM_SEQUENCE_MAX).optional(),
		is_active: z.boolean().optional(),
	})
	.refine((item) => hasDistinctLanguages(item.names), { message: "a language is named twice" })

export const codeListItemsSchema = z
	.array(codeListItemSchema)
	.max(CODE_LIST_ITEMS_MAX)
	.refine((items) => new Set(items.map((item) => item.code)).size === items.length, {
		message: "an item code is listed twice",
	})

export type CodeListItemsInput = z.infer<typeof codeListItemsSchema>

// administration.yaml CodeListTranslationImport, CAP-017-R18
export const translationImportSchema = z.strictObject({
	language: languageCode,
	reason: z.string().trim().min(1).max(CONFIGURATION_REASON_MAX_LENGTH),
	items: z
		.array(
			z.strictObject({
				code_list_code: z.string().trim().max(CODE_LIST_CODE_MAX_LENGTH),
				code: z.string().trim().max(CODE_LIST_CODE_MAX_LENGTH),
				// CAP-017-R18 name-missing
				name: z.string().max(CODE_LIST_ITEM_NAME_MAX_LENGTH).regex(CODE_LIST_ITEM_NAME_PATTERN),
			}),
		)
		.min(1)
		.max(CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS),
})

export type TranslationImportInput = z.infer<typeof translationImportSchema>
