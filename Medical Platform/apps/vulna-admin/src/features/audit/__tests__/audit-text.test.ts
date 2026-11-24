import { describe, expect, it } from "vitest"
import {
	deliveryClosureReasonText,
	discardSituationText,
	draftDiscardReasonText,
	eventText,
	eventTypeText,
	previousStateTermOf,
	reasonTermOf,
	recordOutcomeText,
} from "@/features/audit/lib/audit-text"

const CONSENT = "44444444-4444-4444-8444-444444444444"

describe("discarded draft in the audit log CAP-025-R20", () => {
	it("names the situation in which the draft was discarded", () => {
		expect(discardSituationText("logout")).toBe("Odhlášení")
		expect(discardSituationText("administrator_consent")).toBe("Souhlas správce")
	})

	it("CAP-015-R17 gives the explicit discard by the author as the reason", () => {
		const record = { event_type: "draft-acquisition-discard", reason: null, draft_discard_consent_id: null }

		expect(draftDiscardReasonText(record)).toBe("Výslovné zahození pořizovatelem")
	})

	it("CAP-015-R19 CAP-015-S18 gives the reason of the administrator consent in words", () => {
		const reason = { code: "operator_departed", text: null }

		expect(
			draftDiscardReasonText({ event_type: "draft-acquisition-discard", reason, draft_discard_consent_id: CONSENT }),
		).toBe("Odchod z pracoviště")
		expect(
			draftDiscardReasonText({
				event_type: "draft-discard-consent-granted",
				reason,
				draft_discard_consent_id: CONSENT,
			}),
		).toBe("Odchod z pracoviště")
	})

	it("gives no discard reason for other events and for a consent reason it does not know", () => {
		const unknown = { code: "something_new", text: null }

		expect(
			draftDiscardReasonText({
				event_type: "draft-acquisition-discard",
				reason: unknown,
				draft_discard_consent_id: CONSENT,
			}),
		).toBeUndefined()
		expect(
			draftDiscardReasonText({
				event_type: "login",
				reason: { code: "login-failed", text: null },
				draft_discard_consent_id: null,
			}),
		).toBeUndefined()
	})
})

describe("device state changes in the audit log", () => {
	it("CAP-008-S07 names the state before the block", () => {
		expect(previousStateTermOf("device-blocking")).toBe("Stav před blokací")
	})

	it("CAP-007-S07 names the state at unblocking and the result of the review", () => {
		expect(previousStateTermOf("device-unblocking")).toBe("Stav při odblokování")
		expect(reasonTermOf("device-unblocking")).toBe("Výsledek přezkoumání")
	})

	it("CAP-007-S01 names the state before the revocation and the plain reason", () => {
		expect(previousStateTermOf("device-revocation")).toBe("Stav před zneplatněním")
		expect(reasonTermOf("device-revocation")).toBe("Důvod")
	})
})

describe("closed delivery in the audit log ✓ CAP-023-R28", () => {
	it("CAP-023-R28 gives the reason of the closure in words", () => {
		expect(deliveryClosureReasonText("wrong_patient_or_encounter")).toBe(
			"Chybný pacient nebo návštěva — nesmí se doručit",
		)
	})

	it("gives no words for a reason it does not know", () => {
		expect(deliveryClosureReasonText("something_new")).toBeUndefined()
	})
})

describe("event in the list of the audit log ✓ CAP-025-R07", () => {
	it("CAP-025-R18 names a search for the patient by the way the patient was searched", () => {
		expect(eventText({ event_type: "patient-search", search_method: "nfc_tag" })).toBe("Vyhledání pacienta · NFC")
		expect(eventText({ event_type: "patient-search", search_method: "code" })).toBe("Vyhledání pacienta · Kód")
		expect(eventText({ event_type: "patient-search", search_method: "identifier_search" })).toBe(
			"Vyhledání pacienta · Identifikátor",
		)
	})

	it("CAP-025-R18 names a released list by the screen that showed it, not as a search", () => {
		expect(eventText({ event_type: "patient-search", search_method: "recent_patients" })).toBe("Přehled · Naposledy")
		expect(eventText({ event_type: "patient-search", search_method: "unfinished_encounters" })).toBe(
			"Přehled · Nedokončené",
		)
		expect(eventText({ event_type: "patient-search", search_method: "scheduled_list" })).toBe("Přehled · V plánu")
		expect(eventText({ event_type: "patient-search", search_method: "patient_encounters" })).toBe(
			"Karta pacienta · Návštěvy",
		)
	})

	it("names an event without a way of searching by its type alone", () => {
		expect(eventText({ event_type: "login", search_method: null })).toBe("Přihlášení")
		expect(eventText({ event_type: "login" })).toBe("Přihlášení")
	})
})

describe("outcome in the list of the audit log ✓ CAP-025-R07", () => {
	it("CAP-025-R18 gives a released list the count of what it released, even none", () => {
		const visits = { event_type: "patient-search", search_method: "patient_encounters" } as const

		expect(recordOutcomeText({ ...visits, outcome: "no_match", released_item_count: 0 })).toBe("Vydáno 0")
		expect(
			recordOutcomeText({
				event_type: "patient-search",
				search_method: "recent_patients",
				outcome: "match",
				released_item_count: 2,
			}),
		).toBe("Vydáno 2")
	})

	it("CAP-025-R18 keeps found and not found for a search for the patient", () => {
		expect(recordOutcomeText({ event_type: "patient-search", search_method: "nfc_tag", outcome: "no_match" })).toBe(
			"Nenalezeno",
		)
		expect(recordOutcomeText({ event_type: "patient-search", search_method: "code", outcome: "match" })).toBe(
			"Nalezeno",
		)
	})

	it("keeps the outcome of a released list that carries no count", () => {
		expect(
			recordOutcomeText({ event_type: "patient-search", search_method: "recent_patients", outcome: "match" }),
		).toBe("Nalezeno")
	})

	it("keeps the outcome of any other event", () => {
		expect(recordOutcomeText({ event_type: "login", outcome: "success" })).toBe("Úspěch")
	})
})

describe("patient search among the event types of the filter ✓ CAP-025-R07", () => {
	it("CAP-025-R18 names the event type for both searches and released lists", () => {
		expect(eventTypeText("patient-search")).toBe("Vyhledání pacienta a výdej seznamů")
	})

	it("CAP-025-R18 names a search recorded before CHG-176 by its own way", () => {
		expect(eventText({ event_type: "patient-search", search_method: "fulltext" })).toBe("Vyhledání pacienta · Fulltext")
	})
})
