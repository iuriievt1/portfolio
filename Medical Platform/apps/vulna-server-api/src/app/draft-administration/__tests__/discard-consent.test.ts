import { describe, expect, it } from "vitest"
import type { OperatorPresenceRow } from "../types/draft-administration.types"
import { isDiscardConsentAllowed } from "../utils/discard-consent"

const DAY_MILLISECONDS = 86_400_000
const ABSENCE_SECONDS = 30 * 86_400
const NOW = new Date("2026-10-16T12:00:00.000Z")
const OPERATOR = "11111111-1111-4111-8111-111111111111"

function presence(overrides: Partial<OperatorPresenceRow>): OperatorPresenceRow {
	return { user_id: OPERATOR, is_active: true, last_login_at: null, has_active_session: false, ...overrides }
}

function daysAgo(days: number): Date {
	return new Date(NOW.getTime() - days * DAY_MILLISECONDS)
}

describe("condition of the administrator consent CAP-015-R19", () => {
	it("CAP-015-S18 allows the consent for a revoked operator however recently they logged in", () => {
		expect(
			isDiscardConsentAllowed(presence({ is_active: false, last_login_at: daysAgo(1) }), ABSENCE_SECONDS, NOW),
		).toBe(true)
	})

	it("CAP-015-S20 refuses the consent for an operator who logged in five days ago", () => {
		expect(isDiscardConsentAllowed(presence({ last_login_at: daysAgo(5) }), ABSENCE_SECONDS, NOW)).toBe(false)
	})

	it("allows the consent once the operator has been away longer than the set time", () => {
		expect(isDiscardConsentAllowed(presence({ last_login_at: daysAgo(31) }), ABSENCE_SECONDS, NOW)).toBe(true)
		expect(isDiscardConsentAllowed(presence({ last_login_at: daysAgo(30) }), ABSENCE_SECONDS, NOW)).toBe(false)
	})

	it("refuses the consent while the operator still has an open session", () => {
		expect(
			isDiscardConsentAllowed(presence({ last_login_at: daysAgo(31), has_active_session: true }), ABSENCE_SECONDS, NOW),
		).toBe(false)
	})

	it("allows the consent for an operator with no login on record", () => {
		expect(isDiscardConsentAllowed(presence({ last_login_at: null }), ABSENCE_SECONDS, NOW)).toBe(true)
	})
})
