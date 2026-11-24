import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"
import type { Card, User } from "@/features/users/types/user.types"

export const USER_STATE_TONE: Readonly<Record<User["state"], PillTone>> = {
	active: PILL_TONE.NEUTRAL,
	revoked: PILL_TONE.CRITICAL,
}

export const CARD_STATE_TONE: Readonly<Record<Card["state"], PillTone>> = {
	valid: PILL_TONE.NEUTRAL,
	revoked: PILL_TONE.CRITICAL,
}
