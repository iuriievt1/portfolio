import type { AdministrationContract, MobileContract } from "@ansora/contracts"
import type { CodeListItemState } from "@ansora/core-server"

type Schemas = MobileContract.components["schemas"]
type AdministrationSchemas = AdministrationContract.components["schemas"]

export type CodeListSet = Schemas["CodeListSet"]
export type CodeListItemView = Schemas["CodeListItem"]
export type BodyDiagramView = CodeListSet["body_diagram"]

export type AdministrationCodeList = AdministrationSchemas["CodeList"]
export type AdministrationCodeListItem = AdministrationSchemas["CodeListItem"]
export type TranslationImportResult = AdministrationSchemas["CodeListTranslationImportResult"]

export interface CodeListAnswer {
	set: CodeListSet
	contentLanguage: string
}

export interface CodeListRow {
	code: string
	name: string
	item_count: number
}

export interface CodeListItemRow {
	id: string
	code_list_code: string
	code: string
	sequence: number
	is_active: boolean
	names: Record<string, string>
}

export interface StoredCodeListItem extends CodeListItemState {
	id: string
	codeListCode: string
}

export interface CodeListSetRow {
	id: string
	version: number
	body_diagram_version: string
}

export interface ItemNameKey {
	itemId: string
	language: string
}

export interface ItemNameWrite extends ItemNameKey {
	name: string
}
