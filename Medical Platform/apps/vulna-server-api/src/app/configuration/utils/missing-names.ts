import { nameIn } from "@ansora/contracts"
import { itemsWithoutName } from "@ansora/core-server"
import type { BodyDiagramRegion } from "@ansora/vulna-domain"
import type { StoredCodeListItem } from "../../code-list/types/code-list.types"
import type { MissingName } from "../types/configuration.types"

// CAP-012-R28, CAP-012-S19, CAP-017-R18, CAP-016-R18
export function missingNamesOf(
	items: readonly StoredCodeListItem[],
	regions: readonly BodyDiagramRegion[],
	language: string,
): MissingName[] {
	const itemNames: MissingName[] = itemsWithoutName(items, language).map((item) => ({
		kind: "code_list_item",
		code_list_code: item.codeListCode,
		code: item.code,
		language,
	}))
	const regionNames: MissingName[] = regions
		.filter((region) => nameIn(region.names, language) === undefined)
		.map((region) => ({ kind: "body_diagram_region", code_list_code: null, code: region.code, language }))
	return [...itemNames, ...regionNames]
}
