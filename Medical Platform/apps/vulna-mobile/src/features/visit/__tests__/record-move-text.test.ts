import {
	ACQUISITION_KIND,
	ACQUISITION_STATE_VALUE,
	ENCOUNTER_STATUS,
	MISSING_STEP,
	PATIENT_SEX,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { Encounter, EncounterAcquisitionItem } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import cs from "../../../i18n/cs.json"
import { MOVE_TARGET, moveConfirmationTextOf } from "../record-move-text"

const SOURCE: Patient = {
	patient_id: "00000000-0000-4000-8000-000000000001",
	identifiers: [{ system: "urn:mou:birth-number", value: "6409051234" }],
	sex: PATIENT_SEX.FEMALE,
}

const TARGET: Patient = {
	patient_id: "00000000-0000-4000-8000-000000000002",
	identifiers: [{ system: "urn:mou:birth-number", value: "5001011234" }],
	sex: PATIENT_SEX.MALE,
}

const VISIT: Encounter = {
	encounter_id: "00000000-0000-4000-8000-000000000003",
	patient_id: TARGET.patient_id,
	date: "2026-10-08",
	source: "worklist",
	status: ENCOUNTER_STATUS.PLANNED,
	accepts_new_records: true,
	scheduled_time: "2026-10-08T08:30:00Z",
}

const SOURCE_VISIT: Encounter = {
	...VISIT,
	encounter_id: "00000000-0000-4000-8000-000000000004",
	patient_id: SOURCE.patient_id,
	source: "created_in_app",
	status: ENCOUNTER_STATUS.IN_PROGRESS,
	started_at: "2026-10-08T07:10:00Z",
	scheduled_time: null,
}

const WOUND: EncounterAcquisitionItem = {
	acquisition_id: "00000000-0000-4000-8000-000000000005",
	kind: ACQUISITION_KIND.PHOTO,
	state: ACQUISITION_STATE_VALUE.DRAFT,
	file_count: 2,
	updated_at: "2026-10-08T07:20:00Z",
	missing_step: MISSING_STEP.BODY_SITE,
}

const DRAFT: AcquisitionDraft = {
	acquisition_id: WOUND.acquisition_id,
	idempotency_key: "00000000-0000-4000-8000-000000000006",
	state: ACQUISITION_STATE_VALUE.DRAFT,
	kind: ACQUISITION_KIND.PHOTO,
	patient: SOURCE,
	encounter: SOURCE_VISIT,
	operator_user_id: "00000000-0000-4000-8000-000000000007",
	started_at: "2026-10-08T07:10:00Z",
	updated_at: "2026-10-08T07:20:00Z",
	version: 3,
	files: [],
}

describe("confirmation of a moved record E117", () => {
	it("CAP-014-R25 CHG-176 names both patients by their identifiers, the target visit and asks to choose the wound again", () => {
		const text = moveConfirmationTextOf(
			{ record: WOUND, draft: DRAFT, patient: TARGET, target: { kind: MOVE_TARGET.EXISTING, encounter: VISIT } },
			cs,
		)
		expect(text).toBe(
			"Záznam Rána (2 snímky) se přesune k jinému pacientovi. Z: 6409051234. " +
				"Do: 5001011234 · návštěva 8. 10. 2026 10:30. Ránu zvolíte znovu na schématu nového pacienta.",
		)
	})

	it("CAP-014-R06 names a new visit as the target", () => {
		const document = { ...WOUND, kind: ACQUISITION_KIND.SCAN, file_count: 3 }
		const text = moveConfirmationTextOf(
			{ record: document, draft: DRAFT, patient: TARGET, target: { kind: MOVE_TARGET.NEW, encounterKey: "key" } },
			cs,
		)
		expect(text).toBe(
			"Záznam Dokument (3 strany) se přesune k jinému pacientovi. Z: 6409051234. Do: 5001011234 · nová návštěva.",
		)
	})

	it("CAP-014-R25 names only the visits when the patient stays", () => {
		const text = moveConfirmationTextOf(
			{
				record: WOUND,
				draft: DRAFT,
				patient: SOURCE,
				target: { kind: MOVE_TARGET.EXISTING, encounter: { ...VISIT, patient_id: SOURCE.patient_id } },
			},
			cs,
		)
		expect(text).toBe(
			"Záznam Rána (2 snímky) se přesune do jiné návštěvy. Z: návštěva 8. 10. 2026 9:10. Do: návštěva 8. 10. 2026 10:30.",
		)
	})
})
