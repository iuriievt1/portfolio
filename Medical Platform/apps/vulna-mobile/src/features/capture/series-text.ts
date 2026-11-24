import type { Texts } from "../../i18n/texts"
import { fillText, numberText } from "../../utils/fill-text"

// CAP-015-R32, E94
export function seriesTitleOf(index: number, count: number, texts: Texts): string {
	const review = texts.capture.review
	return fillText(review.title, { index: index + 1, from: numberText(review.from, count), count }, texts.language)
}

// CAP-015-R33
export function photoLabelOf(index: number, texts: Texts): string {
	return fillText(texts.capture.photo, { index: index + 1 }, texts.language)
}
