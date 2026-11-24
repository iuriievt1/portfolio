// CAP-017-R06, CAP-017-R07, ADR-023, profiles/code-lists.schema.json
export interface ProfileCodeListName {
	language: string
	name: string
}

export interface ProfileCodeListItem {
	code: string
	names: ProfileCodeListName[]
}

export interface ProfileCodeList {
	code: string
	name: string
	items: ProfileCodeListItem[]
}

export interface ProfileCodeLists {
	codeLists: ProfileCodeList[]
}
