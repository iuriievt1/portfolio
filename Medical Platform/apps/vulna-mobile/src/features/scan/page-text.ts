import type { Texts } from "../../i18n/texts"
import { fillText, numberText } from "../../utils/fill-text"

// CAP-018-R11
export function pageLabelOf(index: number, texts: Texts): string {
	return fillText(texts.scan.page, { index: index + 1 }, texts.language)
}

// CAP-018-R11, Figma 06 B.2
export function pageTitleOf(index: number, count: number, texts: Texts): string {
	const review = texts.scan.review
	return fillText(
		review.title,
		{ index: index + 1, from: numberText(texts.capture.review.from, count), count },
		texts.language,
	)
}
