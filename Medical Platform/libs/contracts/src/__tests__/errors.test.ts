import { describe, expect, it } from "vitest"
import { ERROR_CODE, isPermanentRejection, PERMANENT_REJECTIONS } from "../errors"

describe("stable error codes ✓ ADR-012 ř. 52–58", () => {
	it("treats a revoked device as a permanent rejection ✓ NAB-504", () => {
		expect(isPermanentRejection(ERROR_CODE.DEVICE_REVOKED)).toBe(true)
	})

	it("treats a rejected record as a permanent rejection ✓ ADR-012 ř. 55", () => {
		expect(isPermanentRejection(ERROR_CODE.RECORD_REJECTED)).toBe(true)
	})

	it("lets the queue retry on the retry code ✓ NAB-207, NAB-209", () => {
		expect(isPermanentRejection(ERROR_CODE.RETRY)).toBe(false)
	})

	it("does not treat sign-in-again as a permanent rejection", () => {
		expect(isPermanentRejection(ERROR_CODE.SIGN_IN_AGAIN)).toBe(false)
	})

	it("does not treat an unsupported app version as a permanent rejection ✓ CAP-012-R24", () => {
		expect(isPermanentRejection(ERROR_CODE.APP_VERSION_UNSUPPORTED)).toBe(false)
	})

	it("treats every code the contract marks permanent as a permanent rejection ✓ api/README.md 5", () => {
		expect(isPermanentRejection(ERROR_CODE.RESOURCE_NOT_FOUND)).toBe(true)
		expect(isPermanentRejection(ERROR_CODE.IDEMPOTENCY_CONFLICT)).toBe(true)
		expect(isPermanentRejection(ERROR_CODE.PATIENT_MISMATCH)).toBe(true)
		expect(isPermanentRejection(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)).toBe(true)
		expect(isPermanentRejection(ERROR_CODE.OPERATOR_UNVERIFIED)).toBe(true)
		expect(PERMANENT_REJECTIONS).toHaveLength(7)
	})

	it("does not treat the codes the contract calls not permanent as permanent rejections ✓ api/README.md 5", () => {
		expect(isPermanentRejection(ERROR_CODE.ACQUISITION_CLOSED)).toBe(false)
		expect(isPermanentRejection(ERROR_CODE.ACQUISITION_INCOMPLETE)).toBe(false)
		expect(isPermanentRejection(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)).toBe(false)
	})

	it("keeps the wire values the contract defines ✓ ADR-012", () => {
		expect(ERROR_CODE.DEVICE_REVOKED).toBe("device-revoked")
		expect(ERROR_CODE.APP_VERSION_UNSUPPORTED).toBe("app-version-unsupported")
	})
})
