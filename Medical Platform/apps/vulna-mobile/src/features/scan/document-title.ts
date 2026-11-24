import type { AcquisitionDraft, AcquisitionDraftUpdate, DocumentTitle } from "../../api/acquisitions"
import type { CodeListItem } from "../../api/code-lists"
import type { LocalizedNameOf } from "../../i18n/language-store"

// CAP-018-R15, CAP-017-R09
export function titleCodeUpdateOf(
	draft: AcquisitionDraft,
	code: string,
	codeListVersion: string,
): AcquisitionDraftUpdate | undefined {
	if (draft.document_title?.code === code) {
		return undefined
	}
	return { document_title: { code, code_list_version: codeListVersion } }
}

// CAP-018-R15
export function titleTextUpdateOf(draft: AcquisitionDraft, text: string): AcquisitionDraftUpdate | undefined {
	const title = text.trim()
	if (title === "" || draft.document_title?.text === title) {
		return undefined
	}
	return { document_title: { text: title } }
}

// CAP-018-R15, CAP-017-R18
export function documentTitleTextOf(
	title: DocumentTitle | undefined,
	items: readonly CodeListItem[],
	nameOf: LocalizedNameOf,
): string | undefined {
	if (title === undefined) {
		return undefined
	}
	if (title.text !== undefined) {
		return title.text
	}
	const item = items.find((candidate) => candidate.code === title.code)
	return item === undefined ? title.code : nameOf(item.names)
}
