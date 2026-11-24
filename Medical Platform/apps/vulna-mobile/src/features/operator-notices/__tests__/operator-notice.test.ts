import { ACQUISITION_KIND, OPERATOR_NOTIFICATION_KIND, PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import type { OperatorNotification } from "../../../api/operator-notifications"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import type { Texts } from "../../../i18n/texts"
import { formatDate, formatDateTime } from "../../../utils/format-date"
import { operatorNoticeOf } from "../operator-notice"

const DRAFT: AcquisitionDraftSummary = {
	acquisition_id: "00000000-0000-4000-8000-000000000001",
	kind: ACQUISITION_KIND.PHOTO,
	patient: {
		patient_id: "00000000-0000-4000-8000-000000000002",
		identifiers: [{ system: "urn:mou:patient", value: "0074519" }],
		sex: PATIENT_SEX.FEMALE,
	},
	encounter_id: "00000000-0000-4000-8000-000000000003",
	file_count: 3,
	started_at: "2026-09-10T06:30:00Z",
	updated_at: "2026-09-12T06:42:00Z",
	rejected_file_count: 0,
	reminder_due: true,
}

const DISCARDED_AT = "2026-10-16T08:15:00Z"

function discarded(count: number): OperatorNotification {
	return {
		notification_id: "00000000-0000-4000-8000-000000000010",
		kind: OPERATOR_NOTIFICATION_KIND.DRAFT_DISCARDED_BY_ADMINISTRATOR,
		created_at: DISCARDED_AT,
		discarded_count: count,
		discarded_at: DISCARDED_AT,
	}
}

const REMINDER: OperatorNotification = {
	notification_id: "00000000-0000-4000-8000-000000000011",
	kind: OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER,
	created_at: "2026-10-16T08:00:00Z",
	acquisition_id: DRAFT.acquisition_id,
}

describe("operator notices after login CAP-015-R20, CAP-015-R18", () => {
	it("CAP-015-S23 tells how many drafts the administrator discarded and when, without the patient", () => {
		const time = formatDateTime(new Date(DISCARDED_AT), cs.language)

		expect(operatorNoticeOf(discarded(2), [DRAFT], cs).body).toBe(
			`2 vaše rozpracované záznamy byly ${time} se souhlasem správce aplikace zahozeny. Nic z nich neodešlo do PACS.`,
		)
		expect(operatorNoticeOf(discarded(1), [DRAFT], cs).body).toContain("1 váš rozpracovaný záznam byl")
		expect(operatorNoticeOf(discarded(5), [DRAFT], cs).body).toContain("5 vašich rozpracovaných záznamů bylo")
		expect(operatorNoticeOf(discarded(2), [DRAFT], cs).body).not.toContain("0074519")
		expect(operatorNoticeOf(discarded(2), [DRAFT], cs).draft).toBeUndefined()
	})

	it("CAP-015-S43 reminds the forgotten draft with its patient, files and the day it stopped", () => {
		const notice = operatorNoticeOf(REMINDER, [DRAFT], cs)

		expect(notice.title).toBe(`Rozpracovaný záznam čeká od ${formatDate(new Date(DRAFT.updated_at), cs.language)}`)
		expect(notice.body).toBe("Záznam pacienta 0074519 (3 snímky) ještě není uzavřený. Uzavřete ho, nebo ho zahoďte.")
		expect(notice.draft).toBe(DRAFT)
	})

	it("reminds without a link when the draft is no longer among the own drafts", () => {
		const notice = operatorNoticeOf(REMINDER, [], cs)

		expect(notice.title).toBe(cs.operatorNotices.reminder.titleUndated)
		expect(notice.draft).toBeUndefined()
	})

	it("CAP-019-R27 shows a notice of an unknown kind as a general one", () => {
		const unknown = { ...REMINDER, kind: "future_kind" } as unknown as OperatorNotification

		expect(operatorNoticeOf(unknown, [DRAFT], cs)).toMatchObject({
			title: cs.operatorNotices.other.title,
			draft: undefined,
		})
	})

	it("CAP-015-R28 declines the count in English too", () => {
		expect(operatorNoticeOf(discarded(1), [], en as Texts).body).toContain("1 of your records in progress was")
		expect(operatorNoticeOf(discarded(3), [], en as Texts).body).toContain("3 of your records in progress were")
	})
})
