import { ACQUISITION_KIND, ACQUISITION_STATE_VALUE, ENCOUNTER_STATUS, MISSING_STEP } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { Encounter, EncounterAcquisitionItem } from "../../../api/encounters"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import { layeredTexts } from "../../../i18n/texts"
import { PILL_TONE } from "../../../ui/pill-tone"
import { RECORD_NOTE } from "../../upload/record-note"
import { targetVisitsOf } from "../move-targets"
import {
	cancelUnavailableReasonOf,
	earlierNoticeOf,
	encounterMomentOf,
	isCancellable,
	isMovable,
	missingStepTextOf,
	ownDraftOf,
	recordDetailOf,
	recordStatusOf,
	VISIT_MODE,
	visitModeOf,
	visitMomentOf,
	visitTitleOf,
	visitWhenOf,
	visitWhenTextOf,
} from "../visit-view"

const ENCOUNTER: Encounter = {
	encounter_id: "00000000-0000-4000-8000-000000000001",
	patient_id: "00000000-0000-4000-8000-000000000002",
	date: "2026-09-19",
	source: "created_in_app",
	status: ENCOUNTER_STATUS.IN_PROGRESS,
	accepts_new_records: true,
	started_at: "2026-09-19T06:30:00Z",
	acquisition_count: 2,
}

const DRAFT: EncounterAcquisitionItem = {
	acquisition_id: "00000000-0000-4000-8000-000000000003",
	kind: ACQUISITION_KIND.PHOTO,
	state: ACQUISITION_STATE_VALUE.DRAFT,
	file_count: 2,
	updated_at: "2026-09-19T07:24:00Z",
	missing_step: MISSING_STEP.BODY_SITE,
}

const RECEIVED: EncounterAcquisitionItem = {
	acquisition_id: "00000000-0000-4000-8000-000000000004",
	kind: ACQUISITION_KIND.SCAN,
	state: ACQUISITION_STATE_VALUE.RECEIVED,
	file_count: 2,
	updated_at: "2026-09-19T07:18:00Z",
	missing_step: null,
}

describe("visitModeOf", () => {
	it("CAP-014-R06 opens a new visit the server does not know yet for adding", () => {
		expect(visitModeOf(undefined)).toBe(VISIT_MODE.OPEN)
	})

	it("CAP-014-S32 opens a finished visit read only", () => {
		expect(visitModeOf({ ...ENCOUNTER, status: ENCOUNTER_STATUS.COMPLETED })).toBe(VISIT_MODE.CLOSED)
	})

	it("CAP-014-S53 offers only finishing in a visit in progress from an earlier day", () => {
		expect(visitModeOf({ ...ENCOUNTER, accepts_new_records: false })).toBe(VISIT_MODE.EARLIER)
	})

	it("CAP-014-R30 offers no action when the server does not say the visit accepts records", () => {
		expect(visitModeOf({ ...ENCOUNTER, status: ENCOUNTER_STATUS.PLANNED, accepts_new_records: undefined })).toBe(
			VISIT_MODE.CLOSED,
		)
	})
})

describe("visitTitleOf", () => {
	it("E101 names the visit by its day and time in Prague time", () => {
		const when = visitWhenOf(ENCOUNTER, new Date(), cs.language)
		expect(visitTitleOf(when, cs)).toBe("Návštěva 19. 9. 2026 · 8:30")
		expect(visitWhenTextOf(when, cs)).toBe("19. 9. 2026 8:30")
	})

	it("CAP-014-S13 leaves out a time the work list does not carry", () => {
		const planned = { ...ENCOUNTER, status: ENCOUNTER_STATUS.PLANNED, started_at: null, scheduled_time: null }
		const when = visitWhenOf(planned, new Date(), cs.language)
		expect(visitTitleOf(when, cs)).toBe("Návštěva 19. 9. 2026")
		expect(visitWhenTextOf(when, cs)).toBe("19. 9. 2026")
	})
})

describe("record rows", () => {
	it("CAP-019-R28 shows a draft as in progress with the step it misses", () => {
		expect(recordStatusOf(DRAFT, cs)).toEqual({ tone: PILL_TONE.WARN, label: "Rozpracováno" })
		expect(recordDetailOf(DRAFT, cs, RECORD_NOTE.NONE)).toBe("chybí poloha rány · 2 snímky · 9:24")
	})

	it("CAP-019-R29 CAP-019-S20 E93 shows a draft whose summary waits in the queue as closing after the upload", () => {
		expect(recordDetailOf(DRAFT, cs, RECORD_NOTE.CLOSING_QUEUED)).toBe("uzavře se po nahrání · 2 snímky · 9:24")
		expect(missingStepTextOf(DRAFT, cs, RECORD_NOTE.CLOSING_QUEUED)).toBe("uzavře se po nahrání")
	})

	it("CAP-015-R36 CAP-009-S05 Q-076 shows the missing photo of a draft to take again before any other step", () => {
		expect(recordDetailOf(DRAFT, cs, RECORD_NOTE.RETAKE)).toBe("chybí snímek · 2 snímky · 9:24")
		expect(recordDetailOf(RECEIVED, cs, RECORD_NOTE.RETAKE)).toBe("2 strany · 9:18")
	})

	it("CAP-015-R35 E101 E111 shows a draft with a file still waiting on another device", () => {
		const waiting = { ...DRAFT, files_on_other_device: true }

		expect(recordDetailOf(waiting, cs, RECORD_NOTE.CLOSING_QUEUED)).toBe("čeká na jiném zařízení · 2 snímky · 9:24")
		expect(recordDetailOf(waiting, cs, RECORD_NOTE.RETAKE)).toBe("chybí snímek · 2 snímky · 9:24")
	})

	it("CAP-019-R28 shows a received record as done, without its delivery to PACS", () => {
		expect(recordStatusOf(RECEIVED, cs)).toEqual({ tone: PILL_TONE.SUCCESS, label: "Hotovo" })
		expect(recordDetailOf(RECEIVED, cs, RECORD_NOTE.CLOSING_QUEUED)).toBe("2 strany · 9:18")
	})

	it("CAP-019-R27 shows a state it does not know as unknown", () => {
		expect(recordStatusOf({ ...RECEIVED, state: "assembling" as EncounterAcquisitionItem["state"] }, cs)).toEqual({
			tone: PILL_TONE.NEUTRAL,
			label: "Neznámý stav",
		})
	})

	it("CAP-014-S30 finds the own draft that keeps the visit from finishing", () => {
		expect(ownDraftOf([RECEIVED, DRAFT])).toBe(DRAFT)
		expect(ownDraftOf([RECEIVED])).toBeUndefined()
	})
})

describe("visit of an earlier day E120", () => {
	const earlier = { ...ENCOUNTER, date: "2026-09-16", accepts_new_records: false }

	it("CAP-014-R30 says from which day the visit is, with the preposition the day needs", () => {
		expect(earlierNoticeOf(earlier, cs)).toBe(
			"Návštěva je ze 16. 9. Přidat do ní nic nového nejde: vlastní rozpracovaný záznam v ní dokončete a návštěvu dokončete. Nové snímky patří do nové návštěvy.",
		)
		expect(earlierNoticeOf({ ...earlier, date: "2026-09-15" }, cs)).toMatch(/^Návštěva je z 15\. 9\. /)
		expect(earlierNoticeOf({ ...earlier, date: "2026-09-02" }, cs)).toMatch(/^Návštěva je ze 2\. 9\. /)
	})

	it("CAP-015-R23 takes the preposition from the language file, not from the code", () => {
		expect(earlierNoticeOf(earlier, layeredTexts(cs.language, [en.language]))).toMatch(/^The visit is from 9\/16\. /)
	})

	it("CAP-014-R30 says a planned visit of an earlier day never started", () => {
		expect(earlierNoticeOf({ ...earlier, status: ENCOUNTER_STATUS.PLANNED }, cs)).toBe(
			"Návštěva byla naplánovaná na 16. 9. a nezačala. Jen ke čtení; nové focení patří do nové návštěvy.",
		)
	})

	it("says nothing about a visit of today or a finished one", () => {
		expect(earlierNoticeOf(ENCOUNTER, cs)).toBeUndefined()
		expect(earlierNoticeOf({ ...earlier, status: ENCOUNTER_STATUS.COMPLETED }, cs)).toBeUndefined()
		expect(earlierNoticeOf(undefined, cs)).toBeUndefined()
	})
})

describe("visit cancellation Q-150", () => {
	it("offers the cancellation only in a visit in progress", () => {
		expect(isCancellable(ENCOUNTER)).toBe(true)
		expect(isCancellable({ ...ENCOUNTER, accepts_new_records: false })).toBe(true)
		expect(isCancellable({ ...ENCOUNTER, status: ENCOUNTER_STATUS.PLANNED })).toBe(false)
		expect(isCancellable({ ...ENCOUNTER, status: ENCOUNTER_STATUS.COMPLETED })).toBe(false)
		expect(isCancellable(undefined)).toBe(false)
	})

	it("explains why a visit with a completed record cannot be cancelled", () => {
		expect(cancelUnavailableReasonOf([DRAFT, RECEIVED], cs)).toBe("V návštěvě už je dokončený záznam.")
		expect(cancelUnavailableReasonOf([DRAFT], cs)).toBeUndefined()
	})

	it("names the visit by its day and time in the confirmation", () => {
		expect(visitMomentOf(visitWhenOf(ENCOUNTER, new Date(), cs.language), cs)).toBe("19. 9. 2026 · 8:30")
	})
})

describe("record move CAP-014-R25", () => {
	it("CAP-014-S42 offers the move only for an own draft outside a finished visit", () => {
		expect(isMovable(DRAFT, VISIT_MODE.OPEN)).toBe(true)
		expect(isMovable(DRAFT, VISIT_MODE.EARLIER)).toBe(true)
		expect(isMovable(DRAFT, VISIT_MODE.CLOSED)).toBe(false)
		expect(isMovable(RECEIVED, VISIT_MODE.OPEN)).toBe(false)
	})

	it("CAP-014-R07 offers only open visits of today other than the source as the target", () => {
		const source = ENCOUNTER
		const planned = { ...ENCOUNTER, encounter_id: "00000000-0000-4000-8000-000000000010" }
		const earlier = { ...ENCOUNTER, encounter_id: "00000000-0000-4000-8000-000000000011", accepts_new_records: false }
		expect(targetVisitsOf([source, planned, earlier], source.encounter_id)).toEqual([planned])
	})
})

describe("encounterMomentOf", () => {
	it("CAP-014-R16 times a planned visit by its schedule", () => {
		const planned = { ...ENCOUNTER, status: ENCOUNTER_STATUS.PLANNED, scheduled_time: "2026-09-19T08:00:00Z" }
		expect(encounterMomentOf(planned)).toBe("2026-09-19T08:00:00Z")
	})

	it("CAP-014-R03 times a started visit by its start and falls back to its schedule", () => {
		expect(encounterMomentOf(ENCOUNTER)).toBe("2026-09-19T06:30:00Z")
		const fromWorkList = { ...ENCOUNTER, started_at: null, scheduled_time: "2026-09-19T08:00:00Z" }
		expect(encounterMomentOf(fromWorkList)).toBe("2026-09-19T08:00:00Z")
	})

	it("CAP-014-S13 never makes up a time", () => {
		expect(encounterMomentOf({ ...ENCOUNTER, started_at: null, scheduled_time: null })).toBeUndefined()
	})
})
