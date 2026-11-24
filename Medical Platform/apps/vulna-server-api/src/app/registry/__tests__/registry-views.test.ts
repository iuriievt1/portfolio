import { PATIENT_SEX, SYNC_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { patientViewOf } from "../utils/patient-view"
import { syncStateViewOf } from "../utils/sync-state-view"

const STARTED_AT = new Date("2026-10-06T08:00:00Z")

describe("sync state for the administration NAB-347", () => {
	it("waits before the first run", () => {
		expect(syncStateViewOf(undefined, 0)).toEqual({ state: SYNC_STATE.WAITING, cached_patient_count: 0 })
	})

	it("shows a run in progress", () => {
		expect(syncStateViewOf({ started_at: STARTED_AT, finished_at: null, outcome: null, failed: false }, 12)).toEqual({
			state: SYNC_STATE.RUNNING,
			last_run_at: STARTED_AT.toISOString(),
			cached_patient_count: 12,
		})
	})

	it("CAP-024-S02 shows that the last run was incomplete", () => {
		const view = syncStateViewOf(
			{ started_at: STARTED_AT, finished_at: STARTED_AT, outcome: "incomplete", failed: false },
			12,
		)
		expect(view.state).toBe(SYNC_STATE.INCOMPLETE_OUTCOME)
	})

	it("shows that the last run ended with an error", () => {
		const view = syncStateViewOf(
			{ started_at: STARTED_AT, finished_at: STARTED_AT, outcome: "incomplete", failed: true },
			12,
		)
		expect(view.state).toBe(SYNC_STATE.FAILED)
	})

	it("waits for the next run after a complete one", () => {
		const view = syncStateViewOf(
			{ started_at: STARTED_AT, finished_at: STARTED_AT, outcome: "complete", failed: false },
			12,
		)
		expect(view.state).toBe(SYNC_STATE.WAITING)
	})
})

describe("patient in the identification result CAP-013-R09, NAB-479", () => {
	it("CHG-176 sends the identifiers and the sex of the patient and nothing else", () => {
		const view = patientViewOf({
			patient: { id: "patient-1", sex: PATIENT_SEX.FEMALE },
			identifiers: [{ patient_id: "patient-1", system: "urn:oid:2.25.1", value: "5603121234", issuer: "MOU" }],
		})
		expect(view).toEqual({
			patient_id: "patient-1",
			identifiers: [{ system: "urn:oid:2.25.1", value: "5603121234", issuer: "MOU" }],
			sex: PATIENT_SEX.FEMALE,
		})
	})

	it("CHG-175 leaves out a missing issuer of a patient created from the wristband", () => {
		const view = patientViewOf({
			patient: { id: "patient-1", sex: null },
			identifiers: [{ patient_id: "patient-1", system: "urn:oid:2.25.1", value: "5603121234", issuer: null }],
		})
		expect(view).toEqual({
			patient_id: "patient-1",
			identifiers: [{ system: "urn:oid:2.25.1", value: "5603121234" }],
			sex: null,
		})
	})
})
