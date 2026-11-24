import { CODE_LIST_ITEM_CODE_MAX_LENGTH, CODE_LIST_ITEM_CODE_PATTERN, nameIn } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"

const texts = cs.codeLists.items.errors

// CAP-017-R08, CAP-017-R18
const itemSchema = z.object({
	code: z.string(),
	isNew: z.boolean(),
	isActive: z.boolean(),
	names: z.record(z.string(), z.string()),
	storedNames: z.record(z.string(), z.string()),
})

const itemsSchema = z.object({ items: z.array(itemSchema) })

export type EditableItem = z.infer<typeof itemSchema>

export type CodeListItemsValues = z.infer<typeof itemsSchema>

function isValidCode(code: string): boolean {
	return CODE_LIST_ITEM_CODE_PATTERN.test(code) && code.length <= CODE_LIST_ITEM_CODE_MAX_LENGTH
}

// CAP-017-R08, CAP-017-R18, CAP-017-S08
export function codeListItemsSchema(defaultLanguage: string) {
	return itemsSchema.superRefine((values, context) => {
		const codes = values.items.map((item) => item.code.trim())
		values.items.forEach((item, index) => {
			const code = codes[index] ?? ""
			const codePath = ["items", index, "code"]
			const isTaken = codes.some((other, otherIndex) => otherIndex !== index && other === code)
			if (item.isNew && code === "") {
				context.addIssue({ code: "custom", path: codePath, message: texts.codeRequired })
			} else if (item.isNew && !isValidCode(code)) {
				context.addIssue({ code: "custom", path: codePath, message: texts.codeFormat })
			} else if (item.isNew && isTaken) {
				context.addIssue({ code: "custom", path: codePath, message: texts.codeTaken })
			}
			if ((nameIn(item.names, defaultLanguage) ?? "").trim() === "") {
				context.addIssue({
					code: "custom",
					path: ["items", index, "names", defaultLanguage],
					message: texts.nameRequired,
				})
			}
		})
	})
}
