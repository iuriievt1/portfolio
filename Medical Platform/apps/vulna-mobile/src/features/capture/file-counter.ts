import type { Texts } from "../../i18n/texts"
import { fillText, numberText } from "../../utils/fill-text"

// CAP-015-R13, CAP-018-R12
export function fileCounterOf(count: number, limit: number, texts: Texts): string {
	return fillText(texts.files.counter, { count, limit }, texts.language)
}

// CAP-015-R13, CAP-018-R12, CAP-015-R28
export function fileCounterLabelOf(label: string, count: number, limit: number, texts: Texts): string {
	return fillText(label, { count, from: numberText(texts.capture.review.from, limit), limit }, texts.language)
}
