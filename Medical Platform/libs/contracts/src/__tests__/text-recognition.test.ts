import { describe, expect, it } from "vitest"
import { ASSEMBLY_FAILURE_REASON, DELIVERY_STATE, DELIVERY_STATES, hasTextRecognitionFailed } from "../acquisitions"

describe("a failed text recognition ✓ CAP-022-R11, CAP-022-R15", () => {
	it("CAP-022-R15 recognises only an assembly that failed on the text recognition", () => {
		expect(hasTextRecognitionFailed(DELIVERY_STATE.ASSEMBLY_FAILED, ASSEMBLY_FAILURE_REASON.OCR_FAILED)).toBe(true)
		expect(hasTextRecognitionFailed(DELIVERY_STATE.ASSEMBLY_FAILED, "clinical_record_missing")).toBe(false)
		expect(hasTextRecognitionFailed(DELIVERY_STATE.ASSEMBLY_FAILED, null)).toBe(false)
	})

	it.each(DELIVERY_STATES.filter((state) => state !== DELIVERY_STATE.ASSEMBLY_FAILED))(
		"never takes a delivery in %s for a failed text recognition",
		(state) => {
			expect(hasTextRecognitionFailed(state, ASSEMBLY_FAILURE_REASON.OCR_FAILED)).toBe(false)
		},
	)
})
