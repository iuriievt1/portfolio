import { PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { Patient } from "../../../api/patients"
import { SYMBOL_SEX } from "../../../ui/icons/sex-symbol-look"
import { patientNumberOf, symbolSexOf } from "../patient-identity"

const PATIENT: Patient = {
	patient_id: "00000000-0000-4000-8000-000000000001",
	identifiers: [
		{ system: "urn:mou:birth-number", value: "6409051234" },
		{ system: "urn:mou:patient", value: "0098812" },
	],
	sex: PATIENT_SEX.FEMALE,
}

describe("patient identity", () => {
	it("CAP-013-R09 CAP-013-R19 CHG-176 shows the first identifier the server lists without a label", () => {
		expect(patientNumberOf(PATIENT)).toBe("6409051234")
	})

	it("Q-132 shows no symbol when the sex is unknown or other", () => {
		expect(symbolSexOf(PATIENT_SEX.FEMALE)).toBe(SYMBOL_SEX.FEMALE)
		expect(symbolSexOf(PATIENT_SEX.MALE)).toBe(SYMBOL_SEX.MALE)
		expect(symbolSexOf(PATIENT_SEX.OTHER)).toBeUndefined()
		expect(symbolSexOf(null)).toBeUndefined()
	})
})
