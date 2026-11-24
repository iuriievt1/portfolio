import { PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { Patient } from "../../../api/patients"
import { matchIssuerOf } from "../patient-match"

const SYSTEM = "urn:vulna:synthetic:patient-id"
const READ = { system: SYSTEM, value: "1000101" }

const PATIENT: Patient = {
	patient_id: "00000000-0000-4000-8000-000000000001",
	identifiers: [
		{ system: "urn:vulna:synthetic:other-id", value: "1000101", issuer: "OTHER" },
		{ system: SYSTEM, value: "1000101", issuer: "FNBRNO" },
	],
	sex: PATIENT_SEX.FEMALE,
}

describe("match row E116", () => {
	it("CAP-013-S19 CAP-024-R07 shows the issuer of the identifier that was read", () => {
		expect(matchIssuerOf(PATIENT, READ)).toBe("FNBRNO")
	})

	it("leaves out an issuer the registry does not give", () => {
		const withoutIssuer = { ...PATIENT, identifiers: [{ system: SYSTEM, value: "1000101" }] }
		expect(matchIssuerOf(withoutIssuer, READ)).toBeUndefined()
	})
})
