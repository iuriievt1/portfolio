import type { Texts } from "../../i18n/texts"
import { countText } from "../../utils/fill-text"

// CAP-008-R06, CAP-008-R11, CAP-008-S07, E10
export function blockedBodyOf(texts: Texts, unsentCount: number | undefined): string {
	const registered = texts.device.blockedRegistered
	if (unsentCount === undefined || unsentCount === 0) {
		return registered.body
	}
	return countText(registered.bodyWithUnsent, unsentCount, texts.language)
}
