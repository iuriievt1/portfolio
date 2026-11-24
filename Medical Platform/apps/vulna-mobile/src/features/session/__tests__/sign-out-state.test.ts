import { ACQUISITION_KIND, ERROR_CODE, PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { ApiProblemError } from "../../../api/api-error"
import {
	checkFailureStateOf,
	SIGN_OUT,
	SIGN_OUT_STATE,
	unclosedDraftStateOf,
	unconfirmedDraftsOf,
	waitingStateOf,
} from "../sign-out-state"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/session/sign-out")),
}))

const SERVICE_UNAVAILABLE = 503

function draft(acquisitionId: string): AcquisitionDraftSummary {
	return {
		acquisition_id: acquisitionId,
		kind: ACQUISITION_KIND.PHOTO,
		patient: {
			patient_id: "00000000-0000-4000-8000-000000000002",
			identifiers: [{ system: "urn:mou:patient", value: "0074519" }],
			sex: PATIENT_SEX.FEMALE,
		},
		encounter_id: "00000000-0000-4000-8000-000000000003",
		file_count: 3,
		started_at: "2026-10-16T06:30:00Z",
		updated_at: "2026-10-16T06:42:00Z",
		rejected_file_count: 0,
		reminder_due: false,
	}
}

describe("sign-out with an unclosed record CAP-015-R16", () => {
	it("CAP-015-S09 warns about the one unclosed record", () => {
		const only = draft("00000000-0000-4000-8000-000000000001")

		expect(unclosedDraftStateOf([only])).toEqual({ kind: SIGN_OUT_STATE.UNCLOSED_DRAFT, draft: only })
	})

	it("warns once about several unclosed records, however many the limit allows", () => {
		const drafts = ["1", "2", "3", "4", "5"].map((suffix) => draft(`00000000-0000-4000-8000-00000000000${suffix}`))

		expect(unclosedDraftStateOf(drafts)).toEqual({ kind: SIGN_OUT_STATE.UNCLOSED_DRAFTS, count: 5 })
	})

	it("does not warn without an unclosed record", () => {
		expect(unclosedDraftStateOf([])).toBeUndefined()
	})

	it("CAP-019-R29 E40 does not count a record whose confirmed summary waits in the queue", () => {
		const waiting = draft("00000000-0000-4000-8000-000000000001")
		const open = draft("00000000-0000-4000-8000-000000000002")

		expect(unconfirmedDraftsOf([waiting, open], new Set([waiting.acquisition_id]))).toEqual([open])
	})
})

describe("sign-out while own files upload CAP-002-R14", () => {
	it("CAP-002-S12 does not sign out while the server misses own files and says how many", () => {
		expect(waitingStateOf(2, false, false)).toEqual({
			kind: SIGN_OUT_STATE.FILES_UPLOADING,
			count: 2,
			isClosingQueued: false,
		})
		expect(waitingStateOf(2, true, true)).toMatchObject({ isClosingQueued: true })
	})

	it("CAP-002-S02 lets the sign-out go on once the server has every own file", () => {
		expect(waitingStateOf(0, false, false)).toBeUndefined()
	})

	it("CAP-019-S21 E9 tells that a confirmed summary still waiting closes only after the next sign-in", () => {
		expect(waitingStateOf(0, true, false)).toEqual(SIGN_OUT.CLOSING_QUEUED)
		expect(waitingStateOf(0, true, true)).toBeUndefined()
	})
})

describe("own records that could not be checked CAP-002-R17", () => {
	it("says the sign-out cannot happen without a connection", () => {
		expect(checkFailureStateOf(new TypeError("Network request failed"))).toEqual(SIGN_OUT.OFFLINE)
	})

	it("says the sign-out failed when the server refused the check", () => {
		expect(checkFailureStateOf(new ApiProblemError(SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toEqual(
			SIGN_OUT.REJECTED,
		)
	})
})
