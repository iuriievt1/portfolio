import { describe, expect, it } from "vitest"
import { DICOM_MAPPING_FAILURE, type DicomMappingFailure } from "../dicom/mapping-error"
import { type DicomPatientSource, dicomPatientOf } from "../dicom/patient"
import type { CustomerIdentifier } from "../ports/clinical-record-store.port"

const BIRTH_NUMBER_SYSTEM = "urn:oid:1.2.203.0.2"
const INSURANCE_SYSTEM = "urn:oid:1.2.203.0.3"
const PERSON_NAME_GROUP_MAX_LENGTH = 64
const LONG_STRING_MAX_LENGTH = 64

const BIRTH_NUMBER: CustomerIdentifier = {
	system: BIRTH_NUMBER_SYSTEM,
	value: "7001011234",
	issuer: undefined,
	validUntil: undefined,
}

const IDENTIFIED_BY_BIRTH_NUMBER: DicomPatientSource = {
	identifiers: [BIRTH_NUMBER],
	familyName: undefined,
	givenName: undefined,
	birthDate: undefined,
	sex: undefined,
}

const FROM_REGISTRY: DicomPatientSource = {
	identifiers: [{ system: INSURANCE_SYSTEM, value: "INS-7", issuer: "VZP", validUntil: undefined }, BIRTH_NUMBER],
	familyName: "Nováková",
	givenName: "Jana",
	birthDate: "1970-01-01",
	sex: "female",
}

function withIdentifiers(...identifiers: CustomerIdentifier[]): DicomPatientSource {
	return { ...IDENTIFIED_BY_BIRTH_NUMBER, identifiers }
}

function refusal(failure: DicomMappingFailure) {
	return expect.objectContaining({ failure })
}

// integrace-dicom.md 5.1
describe("DICOM patient", () => {
	it("CAP-013-R10 a patient identified only by the birth number keeps name, birth date and sex empty", () => {
		expect(dicomPatientOf(IDENTIFIED_BY_BIRTH_NUMBER, BIRTH_NUMBER_SYSTEM)).toEqual({
			patientName: "",
			patientId: "7001011234",
			issuerOfPatientId: undefined,
			patientBirthDate: "",
			patientSex: "",
		})
	})

	it("NAB-373 takes the identifier of the configured system and the demographics from the registry", () => {
		expect(dicomPatientOf(FROM_REGISTRY, INSURANCE_SYSTEM)).toEqual({
			patientName: "Nováková^Jana",
			patientId: "INS-7",
			issuerOfPatientId: "VZP",
			patientBirthDate: "19700101",
			patientSex: "F",
		})
	})

	it("integrace-dicom.md 5.1 skips an identifier that is no longer valid", () => {
		const replaced = { ...BIRTH_NUMBER, value: "7001010000", validUntil: "2026-09-01T00:00:00.000Z" }
		expect(dicomPatientOf(withIdentifiers(replaced, BIRTH_NUMBER), BIRTH_NUMBER_SYSTEM).patientId).toBe("7001011234")
	})

	it("drops empty trailing name components and keeps an empty family name", () => {
		const familyOnly = { ...IDENTIFIED_BY_BIRTH_NUMBER, familyName: "Novák" }
		const givenOnly = { ...IDENTIFIED_BY_BIRTH_NUMBER, givenName: "Jan" }
		expect(dicomPatientOf(familyOnly, BIRTH_NUMBER_SYSTEM).patientName).toBe("Novák")
		expect(dicomPatientOf(givenOnly, BIRTH_NUMBER_SYSTEM).patientName).toBe("^Jan")
	})

	it("maps every sex to its DICOM code", () => {
		const sexOf = (sex: DicomPatientSource["sex"]) =>
			dicomPatientOf({ ...IDENTIFIED_BY_BIRTH_NUMBER, sex }, BIRTH_NUMBER_SYSTEM).patientSex
		expect([sexOf("male"), sexOf("female"), sexOf("other")]).toEqual(["M", "F", "O"])
	})

	it("keeps the longest values DICOM allows", () => {
		const longestId = withIdentifiers({ ...BIRTH_NUMBER, value: "1".repeat(LONG_STRING_MAX_LENGTH) })
		const longestName = { ...IDENTIFIED_BY_BIRTH_NUMBER, familyName: "N".repeat(PERSON_NAME_GROUP_MAX_LENGTH) }
		expect(dicomPatientOf(longestId, BIRTH_NUMBER_SYSTEM).patientId).toHaveLength(LONG_STRING_MAX_LENGTH)
		expect(dicomPatientOf(longestName, BIRTH_NUMBER_SYSTEM).patientName).toHaveLength(PERSON_NAME_GROUP_MAX_LENGTH)
	})

	it("ADR-003 ř. 27 refuses to choose a Patient ID without a configured system (negative)", () => {
		expect(() => dicomPatientOf(IDENTIFIED_BY_BIRTH_NUMBER, undefined)).toThrow(
			refusal(DICOM_MAPPING_FAILURE.PATIENT_ID_SYSTEM_UNSET),
		)
	})

	it("does not fall back to another identifier when the configured one is missing (negative)", () => {
		expect(() => dicomPatientOf(IDENTIFIED_BY_BIRTH_NUMBER, INSURANCE_SYSTEM)).toThrow(
			refusal(DICOM_MAPPING_FAILURE.PATIENT_ID_MISSING),
		)
	})

	it.each([
		["two issuers of the same value", { ...BIRTH_NUMBER, issuer: "MOU" }],
		["two different values", { ...BIRTH_NUMBER, value: "7001015678" }],
	])("integrace-dicom.md 5.1 does not pick one of two current identifiers with %s (negative)", (_, other) => {
		expect(() => dicomPatientOf(withIdentifiers(BIRTH_NUMBER, other), BIRTH_NUMBER_SYSTEM)).toThrow(
			refusal(DICOM_MAPPING_FAILURE.PATIENT_ID_AMBIGUOUS),
		)
	})

	it.each([
		["an empty Patient ID", { identifiers: [{ ...BIRTH_NUMBER, value: "" }] }],
		["a Patient ID over 64 characters", { identifiers: [{ ...BIRTH_NUMBER, value: "1".repeat(65) }] }],
		["a Patient ID with a backslash", { identifiers: [{ ...BIRTH_NUMBER, value: "70\\01" }] }],
		["an issuer over 64 characters", { identifiers: [{ ...BIRTH_NUMBER, issuer: "M".repeat(65) }] }],
		["an issuer with a control character", { identifiers: [{ ...BIRTH_NUMBER, issuer: "MOU\n" }] }],
		["a name with a component separator", { familyName: "Nová^ková" }],
		["a name with a group separator", { givenName: "Ja=na" }],
		["a name with a broken character", { familyName: "No\uD800vák" }],
		["a name over 64 characters", { familyName: "N".repeat(60), givenName: "Jana" }],
		["a birth date that is not an ISO date", { birthDate: "1970" }],
	])("DICOM PS3.5 6.2 refuses %s (negative)", (_, change) => {
		expect(() => dicomPatientOf({ ...IDENTIFIED_BY_BIRTH_NUMBER, ...change }, BIRTH_NUMBER_SYSTEM)).toThrow(
			refusal(DICOM_MAPPING_FAILURE.INVALID_VALUE),
		)
	})
})
