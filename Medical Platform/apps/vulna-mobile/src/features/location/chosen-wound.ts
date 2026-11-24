import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import { formatDate } from "../../utils/format-date"
import { WOUND_CHOICE, type WoundChoice } from "../capture/capture-session"
import type { WoundPlace } from "./body-site-text"

export interface ChosenWound extends WoundPlace {
	title: string
}

// CAP-016-R17, CAP-020-R23, E106, Figma 05 B.3
export function chosenWoundTitleOf(choice: WoundChoice, texts: Texts): string {
	const location = texts.capture.location
	if (choice.kind === WOUND_CHOICE.NEW) {
		return location.newWound
	}
	const number = choice.finding.number
	const takenAt = choice.finding.last_acquisition
	if (takenAt === undefined || takenAt === null) {
		return fillText(location.existingWound, { number }, texts.language)
	}
	const date = formatDate(new Date(takenAt), texts.language)
	return fillText(location.existingWoundLast, { number, date }, texts.language)
}
