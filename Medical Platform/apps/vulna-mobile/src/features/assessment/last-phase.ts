import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import { formatDate } from "../../utils/format-date"
import { type CaptureSession, WOUND_CHOICE } from "../capture/capture-session"
import type { ChoiceBadge } from "./types/choice-badge"

// CAP-017-S11, CAP-016-R17
export function lastPhaseOf(session: CaptureSession, texts: Texts): ChoiceBadge | undefined {
	const wound = session.wound
	if (wound?.kind !== WOUND_CHOICE.EXISTING) {
		return undefined
	}
	const code = wound.finding.last_assessment?.healing_phase_code
	const takenAt = wound.finding.last_acquisition
	if (code === undefined || takenAt === undefined || takenAt === null) {
		return undefined
	}
	const date = formatDate(new Date(takenAt), texts.language)
	return { code, text: fillText(texts.capture.healingPhase.lastBadge, { date }, texts.language) }
}
