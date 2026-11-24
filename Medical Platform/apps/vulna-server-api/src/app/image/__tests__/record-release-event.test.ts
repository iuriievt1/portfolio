import { RELEASE_KIND } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { ENCOUNTER, foundPatient, PATIENT } from "../../encounter/__tests__/encounter-fixtures"
import { recordReleaseEventOf } from "../utils/record-release-event"
import { ACQUISITION, IMAGE } from "./image-fixtures"

describe("audit of a release CAP-025-R28", () => {
	it("CAP-025-R23 records the kind, the record and the count with the patient as the subject, never content", () => {
		const event = recordReleaseEventOf({
			kind: RELEASE_KIND.IMAGE,
			objectId: IMAGE,
			patient: foundPatient(PATIENT),
			encounterId: ENCOUNTER,
			acquisitionId: ACQUISITION,
			releasedItemCount: 1,
		})

		expect(event).toEqual({
			eventType: AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE,
			objectId: IMAGE,
			outcome: AUDIT_OUTCOME.RELEASED,
			details: {
				patient_identifier: foundPatient(PATIENT).identifiers[0]?.value,
				release_kind: RELEASE_KIND.IMAGE,
				encounter_id: ENCOUNTER,
				acquisition_id: ACQUISITION,
				released_item_count: 1,
			},
		})
	})

	it("CAP-020-S14 records a release outside the scope as an ordinary release of nothing", () => {
		const event = recordReleaseEventOf({
			kind: RELEASE_KIND.ACQUISITION_DETAIL,
			objectId: ACQUISITION,
			patient: undefined,
			encounterId: undefined,
			acquisitionId: ACQUISITION,
			releasedItemCount: 0,
		})

		expect(event.outcome).toBe(AUDIT_OUTCOME.RELEASED)
		expect(event.details).toEqual({
			release_kind: RELEASE_KIND.ACQUISITION_DETAIL,
			acquisition_id: ACQUISITION,
			released_item_count: 0,
		})
	})

	it("CAP-020-R05 leaves out a release kind the contract does not name", () => {
		const event = recordReleaseEventOf({
			kind: undefined,
			objectId: IMAGE,
			patient: undefined,
			encounterId: undefined,
			acquisitionId: undefined,
			releasedItemCount: 2,
		})

		expect(event.details).toEqual({ released_item_count: 2 })
	})
})
