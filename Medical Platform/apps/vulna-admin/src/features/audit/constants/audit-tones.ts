import { AUDIT_OUTCOME } from "@ansora/contracts"
import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"

// DESIGN.md 9.1
const OUTCOME_TONE: Readonly<Record<string, PillTone>> = {
	[AUDIT_OUTCOME.SUCCESS]: PILL_TONE.NEUTRAL,
	[AUDIT_OUTCOME.FAILURE]: PILL_TONE.CRITICAL,
	[AUDIT_OUTCOME.QUERY_TOO_SHORT]: PILL_TONE.WARN,
	[AUDIT_OUTCOME.TOO_MANY_MATCHES]: PILL_TONE.WARN,
	[AUDIT_OUTCOME.RATE_LIMITED]: PILL_TONE.WARN,
	[AUDIT_OUTCOME.REJECTED]: PILL_TONE.WARN,
}

export function outcomeTone(code: string): PillTone {
	return OUTCOME_TONE[code] ?? PILL_TONE.NEUTRAL
}
