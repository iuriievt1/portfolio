import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import type { Texts } from "../../i18n/texts"
import { countText, fillText } from "../../utils/fill-text"

const PARAGRAPH_BREAK = "\n\n"

// CAP-015-R16, E40
export function unclosedDraftTextOf(draft: AcquisitionDraftSummary, canDiscard: boolean, texts: Texts): string {
	const unclosed = texts.session.signOut.unclosed
	const files =
		draft.file_count === 0
			? unclosed.noFiles[draft.kind]
			: countText(unclosed.files[draft.kind], draft.file_count, texts.language)
	return fillText(canDiscard ? unclosed.body : unclosed.bodyWithoutDiscard, { files }, texts.language)
}

// CAP-015-R16
export function unclosedDraftsTextOf(count: number, texts: Texts): string {
	return countText(texts.session.signOut.unclosedMany.body, count, texts.language)
}

// CAP-002-R14, CAP-002-S14, CAP-002-S15, E53
export function uploadingTextOf(count: number, isClosingQueued: boolean, texts: Texts): string {
	const uploading = texts.session.signOut.uploading
	const leaving = isClosingQueued ? `${uploading.leaving} ${uploading.closingQueued}` : uploading.leaving
	return [countText(uploading.body, count, texts.language), leaving].join(PARAGRAPH_BREAK)
}
