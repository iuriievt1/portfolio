import { OPERATOR_NOTIFICATION_KIND } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { operatorNotificationViewOf } from "../utils/operator-notification-view"

const NOTIFICATION = "11111111-1111-4111-8111-111111111111"
const DRAFT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CREATED_AT = new Date("2026-10-16T08:00:00.000Z")

describe("operator notification CAP-015-R20, CAP-026-R16", () => {
	it("CAP-015-S23 carries the count and time of the discard and nothing about the patient", () => {
		expect(
			operatorNotificationViewOf({
				id: NOTIFICATION,
				kind: OPERATOR_NOTIFICATION_KIND.DRAFT_DISCARDED_BY_ADMINISTRATOR,
				created_at: CREATED_AT,
				acquisition_id: null,
				discarded_count: 2,
				discarded_at: CREATED_AT,
			}),
		).toEqual({
			notification_id: NOTIFICATION,
			kind: OPERATOR_NOTIFICATION_KIND.DRAFT_DISCARDED_BY_ADMINISTRATOR,
			created_at: CREATED_AT.toISOString(),
			discarded_count: 2,
			discarded_at: CREATED_AT.toISOString(),
		})
	})

	it("CAP-015-S43 names the forgotten draft of a reminder", () => {
		expect(
			operatorNotificationViewOf({
				id: NOTIFICATION,
				kind: OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER,
				created_at: CREATED_AT,
				acquisition_id: DRAFT,
				discarded_count: null,
				discarded_at: null,
			}),
		).toEqual({
			notification_id: NOTIFICATION,
			kind: OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER,
			created_at: CREATED_AT.toISOString(),
			acquisition_id: DRAFT,
		})
	})
})
