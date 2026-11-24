import { ADMINISTRATION_ERROR_CODE, type AdministrationContract } from "@ansora/contracts"
import { errorCodeOf, problemMemberOf } from "@/api/client"
import cs from "@/i18n/cs.json"
import { fillText, formatList } from "@/lib/format"

type MissingName = AdministrationContract.components["schemas"]["MissingName"]

const KIND = {
	CODE_LIST_ITEM: "code_list_item",
	BODY_DIAGRAM_REGION: "body_diagram_region",
} as const

function isMissingName(value: unknown): value is MissingName {
	return typeof value === "object" && value !== null && "code" in value && "kind" in value && "language" in value
}

function itemLabelOf(name: MissingName): string {
	return fillText(cs.errors.missingItem, { codeList: name.code_list_code ?? "", code: name.code })
}

function itemsSentence(items: readonly MissingName[], language: string): string {
	if (items.length === 0) {
		return cs.errors.defaultLanguageNamesMissing
	}
	return fillText(cs.errors.defaultLanguageItemsMissing, { language, names: formatList(items.map(itemLabelOf)) })
}

function regionsSentence(regions: readonly MissingName[], language: string): string | undefined {
	if (regions.length === 0) {
		return undefined
	}
	return fillText(cs.errors.defaultLanguageRegionsMissing, {
		language,
		names: formatList(regions.map((region) => region.code)),
	})
}

// CAP-012-R28, CAP-012-S19, CAP-016-R18
export function missingNamesMessage(error: unknown): string | undefined {
	if (errorCodeOf(error) !== ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING) {
		return undefined
	}
	const member = problemMemberOf(error, "missing_names")
	const names = Array.isArray(member) ? member.filter(isMissingName) : []
	const first = names.at(0)
	if (first === undefined) {
		return undefined
	}
	const items = names.filter((name) => name.kind === KIND.CODE_LIST_ITEM)
	const regions = names.filter((name) => name.kind === KIND.BODY_DIAGRAM_REGION)
	return [itemsSentence(items, first.language), regionsSentence(regions, first.language)]
		.filter((sentence) => sentence !== undefined)
		.join(" ")
}
