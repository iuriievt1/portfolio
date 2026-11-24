import { ACQUISITION_KIND, ENCOUNTER_STATUS, PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import type { Encounter } from "../../../api/encounters"
import cs from "../../../i18n/cs.json"
import { formatDate } from "../../../utils/format-date"
import { RECORD_NOTE } from "../../upload/record-note"
import {
	draftDetailOf,
	recentDetailOf,
	scheduledTimeOf,
	shownDraftsOf,
	unfinishedVisitDetailOf,
	waitingSinceOf,
} from "../overview-rows"

const NOW = new Date("2026-09-19T08:00:00Z")

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
	started_at: "2026-09-19T06:30:00Z",
	updated_at: "2026-09-19T06:42:00Z",
	rejected_file_count: 0,
}

const PLANNED: Encounter = {
	encounter_id: "00000000-0000-4000-8000-000000000004",
	patient_id: "00000000-0000-4000-8000-000000000002",
	date: "2026-09-19",
	source: "worklist",
	status: ENCOUNTER_STATUS.PLANNED,
	scheduled_time: "2026-09-19T08:30:00Z",
}

describe("draftDetailOf", () => {
	it("CAP-015-R29 shows the file count and the time of the last change today", () => {
		expect(draftDetailOf(DRAFT, NOW, cs, RECORD_NOTE.NONE)).toBe("3 snímky · dnes 8:42")
	})

	it("CAP-015-R28 declines the count by the language rules", () => {
		expect(draftDetailOf({ ...DRAFT, file_count: 5, kind: ACQUISITION_KIND.SCAN }, NOW, cs, RECORD_NOTE.NONE)).toBe(
			"5 stran · dnes 8:42",
		)
		expect(draftDetailOf({ ...DRAFT, file_count: 1 }, NOW, cs, RECORD_NOTE.NONE)).toBe("1 snímek · dnes 8:42")
	})

	it("adds the date when the last change was on an earlier day", () => {
		expect(draftDetailOf({ ...DRAFT, updated_at: "2026-09-12T06:42:00Z" }, NOW, cs, RECORD_NOTE.NONE)).toBe(
			"3 snímky · 12. 9. 2026 8:42",
		)
	})

	it("CAP-019-R29 E91 says that a record whose summary waits in the queue closes after the upload", () => {
		expect(draftDetailOf(DRAFT, NOW, cs, RECORD_NOTE.CLOSING_QUEUED)).toBe(
			"3 snímky · dnes 8:42 · uzavře se po nahrání",
		)
	})

	it("CAP-015-R36 CAP-009-S05 Q-076 shows the missing photo or page of a record to take again", () => {
		expect(draftDetailOf(DRAFT, NOW, cs, RECORD_NOTE.RETAKE)).toBe("3 snímky · dnes 8:42 · chybí snímek")
		expect(draftDetailOf({ ...DRAFT, kind: ACQUISITION_KIND.SCAN }, NOW, cs, RECORD_NOTE.RETAKE)).toBe(
			"3 strany · dnes 8:42 · chybí stránka",
		)
	})
})

describe("unfinishedVisitDetailOf", () => {
	const unfinished = {
		patient: DRAFT.patient,
		encounter: { ...PLANNED, status: ENCOUNTER_STATUS.IN_PROGRESS },
		last_documented_at: "2026-09-19T06:42:00Z",
	}

	it("CAP-014-R18 CAP-014-R20 names a visit that waits to be finished and when it was last documented", () => {
		expect(unfinishedVisitDetailOf(unfinished, NOW, cs)).toBe("Nedokončená návštěva · dnes 8:42")
		expect(unfinishedVisitDetailOf({ ...unfinished, last_documented_at: "2026-09-12T06:42:00Z" }, NOW, cs)).toBe(
			"Nedokončená návštěva · 12. 9. 2026 8:42",
		)
	})
})

describe("recentDetailOf", () => {
	const recent = { patient: DRAFT.patient, last_documented_at: "2026-09-19T06:42:00Z" }

	it("CAP-015-R28 shows when the clinician last documented the patient today", () => {
		expect(recentDetailOf(recent, NOW, cs)).toBe("dnes 8:42")
	})

	it("adds the date when it was on an earlier day", () => {
		expect(recentDetailOf({ ...recent, last_documented_at: "2026-09-12T06:42:00Z" }, NOW, cs)).toBe("12. 9. 2026 8:42")
	})
})

describe("scheduledTimeOf", () => {
	it("CAP-014-R16 shows the planned time in Prague time", () => {
		expect(scheduledTimeOf(PLANNED, cs)).toEqual({ text: "10:30", isKnown: true })
	})

	it("CAP-014-S13 never makes up 00:00 for a visit without a planned time", () => {
		expect(scheduledTimeOf({ ...PLANNED, scheduled_time: null }, cs)).toEqual({ text: "čas neurčen", isKnown: false })
	})
})

describe("shownDraftsOf", () => {
	const drafts = ["a", "b", "c", "d"]

	it("CAP-015-R29 shows at most the configured rows and offers the rest on the screen of records in progress", () => {
		expect(shownDraftsOf(drafts, 3)).toEqual({ rows: ["a", "b", "c"], hasMore: true })
	})

	it("CAP-015-R29 offers nothing more when every record fits", () => {
		expect(shownDraftsOf(drafts, 4)).toEqual({ rows: drafts, hasMore: false })
	})

	it("shows every record until the configuration is known", () => {
		expect(shownDraftsOf(drafts, undefined)).toEqual({ rows: drafts, hasMore: false })
	})
})

describe("waitingSinceOf", () => {
	it("CAP-015-S15 marks a draft past the reminder time with the day it stopped", () => {
		expect(waitingSinceOf({ ...DRAFT, reminder_due: true }, cs)).toBe(
			`Čeká od ${formatDate(new Date(DRAFT.updated_at), cs.language)}`,
		)
	})

	it("leaves a recent draft without a mark", () => {
		expect(waitingSinceOf(DRAFT, cs)).toBeUndefined()
		expect(waitingSinceOf({ ...DRAFT, reminder_due: false }, cs)).toBeUndefined()
	})
})
