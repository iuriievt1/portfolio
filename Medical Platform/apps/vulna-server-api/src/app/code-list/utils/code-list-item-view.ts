import { localizedNameOf, nameIn } from "@ansora/contracts"
import type { NameLanguages } from "../../localization/types/localization.types"
import type { AdministrationCodeListItem, CodeListItemView, StoredCodeListItem } from "../types/code-list.types"

// clinical-workflow.yaml CodeListItem, CAP-017-R08, CAP-017-R18
export function codeListItemView(item: StoredCodeListItem, languages: NameLanguages): CodeListItemView {
	return {
		code: item.code,
		text: localizedNameOf(item.names, languages.response, languages.instanceDefault),
		names: { ...item.names },
		is_selectable: item.isActive,
	}
}

// administration.yaml CodeListItem
export function administrationItemView(item: StoredCodeListItem, defaultLanguage: string): AdministrationCodeListItem {
	return {
		code: item.code,
		name: nameIn(item.names, defaultLanguage) ?? "",
		names: { ...item.names },
		sequence: item.sequence,
		is_active: item.isActive,
	}
}
