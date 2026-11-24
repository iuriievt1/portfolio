import { DRAFT_DISCARD_REASON } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { draftDiscardSchema } from "../dto/draft-discard.input.dto"

const OPERATOR = "11111111-1111-4111-8111-111111111111"
const DRAFT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SEEN = "2026-10-01T08:00:00.123456Z"

describe("administrator consent request CAP-015-R19", () => {
	it("accepts named drafts of one operator with a reason", () => {
		const parsed = draftDiscardSchema.safeParse({
			operator_user_id: OPERATOR,
			reason: DRAFT_DISCARD_REASON.LONG_ABSENCE,
			acquisitions: [{ acquisition_id: DRAFT, seen_updated_at: SEEN }],
		})

		expect(parsed.success).toBe(true)
	})

	it("refuses an empty selection, a repeated draft, and a reason outside the list", () => {
		const base = { operator_user_id: OPERATOR, reason: DRAFT_DISCARD_REASON.LONG_ABSENCE }
		const selection = { acquisition_id: DRAFT, seen_updated_at: SEEN }

		expect(draftDiscardSchema.safeParse({ ...base, acquisitions: [] }).success).toBe(false)
		expect(draftDiscardSchema.safeParse({ ...base, acquisitions: [selection, selection] }).success).toBe(false)
		expect(draftDiscardSchema.safeParse({ ...base, reason: "tidying_up", acquisitions: [selection] }).success).toBe(
			false,
		)
	})
})
