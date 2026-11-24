import { describe, expect, it } from "vitest"
import {
	CLINICAL_RECORD_FAILURE,
	ClinicalRecordStoreError,
	isClinicalRecordRejection,
	isClinicalRecordUnavailability,
} from "../ports/clinical-record-store.port"

describe("failures of the clinical record store", () => {
	it("CAP-020-S10 takes an unreachable store and an unknown outcome as unavailability", () => {
		const unreachable = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "ECONNREFUSED")
		const unknown = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "timeout")

		expect(isClinicalRecordUnavailability(unreachable)).toBe(true)
		expect(isClinicalRecordUnavailability(unknown)).toBe(true)
		expect(isClinicalRecordRejection(unreachable)).toBe(false)
	})

	it("takes a refused write as an answer of the store", () => {
		const refused = new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "422")

		expect(isClinicalRecordRejection(refused)).toBe(true)
		expect(isClinicalRecordUnavailability(refused)).toBe(false)
	})

	it("says nothing about an error that did not come from the store", () => {
		expect(isClinicalRecordUnavailability(new TypeError("bug"))).toBe(false)
		expect(isClinicalRecordRejection(new TypeError("bug"))).toBe(false)
	})
})
