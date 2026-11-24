// CAP-017-R05, CAP-018-R15, administration.yaml listCodeLists
export const CODE_LIST = {
	WOUND_TYPE: "wound-type",
	HEALING_PHASE: "healing-phase",
	DOCUMENT_TITLE: "document-title",
} as const

export type CodeListCode = (typeof CODE_LIST)[keyof typeof CODE_LIST]

// CAP-017-R08
export const CODE_LIST_ITEM_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const CODE_LIST_ITEM_CODE_MAX_LENGTH = 64
export const CODE_LIST_ITEM_NAME_MAX_LENGTH = 255
// biome-ignore lint/suspicious/noControlCharactersInRegex: DICOM PS3.5 6.1.3, integrace-dicom.md 5.4
export const CODE_LIST_ITEM_NAME_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]*$/
export const CODE_LIST_TRANSLATION_IMPORT_MAX_ITEMS = 5000
export const CODE_LIST_SET_VERSION_MAX_LENGTH = 64

// CAP-017-R04, clinical-workflow.yaml Assessment
export const CLINICAL_DESCRIPTION_MAX_LENGTH = 4000
// biome-ignore lint/suspicious/noControlCharactersInRegex: DICOM PS3.5 6.1.3, 6.2 LT, integrace-dicom.md 5.4
export const CLINICAL_DESCRIPTION_PATTERN = /^[^\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]*$/

// clinical-workflow.yaml DocumentTitle, CAP-018-R15
export const DOCUMENT_TITLE_TEXT_MAX_LENGTH = 255

// clinical-workflow.yaml DocumentTitle, integrace-dicom.md 5.6
export const DOCUMENT_TITLE_TEXT_PATTERN = CLINICAL_DESCRIPTION_PATTERN

export type LocalizedNames = Readonly<Record<string, string>>

// datovy-model.md 2
export function isSameLanguage(left: string, right: string): boolean {
	return left.toLowerCase() === right.toLowerCase()
}

export function nameIn(names: LocalizedNames, language: string): string | undefined {
	const key = Object.keys(names).find((candidate) => isSameLanguage(candidate, language))
	return key === undefined ? undefined : names[key]
}

// CAP-015-R26, CAP-017-R18, CAP-016-R18
export function localizedNameOf(names: LocalizedNames, language: string, fallback: string): string {
	return nameIn(names, language) ?? nameIn(names, fallback) ?? Object.values(names).at(0) ?? ""
}
