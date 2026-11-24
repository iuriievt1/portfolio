import { PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { PatientIdentifier, PatientRecord } from "../ports/patient-directory.port"
import type { ScheduledEncounter } from "../ports/registry-source.port"
import {
	groupKeysByIdentifier,
	identifierKeyOf,
	patientGroupsOf,
	REGISTRY_RECORD_SOURCE,
	sameIdentifiers,
	uniqueEncountersOf,
} from "../registry/registry-records"

const SYSTEM = "urn:oid:2.25.1"

function identifier(value: string, issuer?: string): PatientIdentifier {
	return { system: SYSTEM, value, issuer }
}

function patient(identifiers: PatientIdentifier[], familyName = "Svobodová"): PatientRecord {
	return { identifiers, familyName, givenName: "Marie", birthDate: "1950-02-01", sex: PATIENT_SEX.FEMALE }
}

function encounter(studyInstanceUid: string, scheduledDate: string, scheduledTime?: string): ScheduledEncounter {
	return {
		patient: patient([identifier("1001")]),
		studyInstanceUid,
		accessionNumber: undefined,
		identifiers: [],
		scheduledDate,
		scheduledTime,
	}
}

describe("patients from registry records CAP-024-R07", () => {
	it("CAP-024-S05 keeps the same value from two issuers as two patients", () => {
		const groups = patientGroupsOf([
			{ record: patient([identifier("1001", "MOU")]), source: REGISTRY_RECORD_SOURCE.WORKLIST },
			{ record: patient([identifier("1001", "FN")]), source: REGISTRY_RECORD_SOURCE.WORKLIST },
		])

		expect(groups).toHaveLength(2)
	})

	it("joins the records of one patient from the worklist and from a query", () => {
		const groups = patientGroupsOf([
			{ record: patient([identifier("1001")], "Svobodova"), source: REGISTRY_RECORD_SOURCE.QUERY },
			{ record: patient([identifier("1001")], "Svobodová"), source: REGISTRY_RECORD_SOURCE.WORKLIST },
		])

		expect(groups).toHaveLength(1)
		expect(groups[0]?.record.familyName).toBe("Svobodová")
		expect(groups[0]?.source).toBe(REGISTRY_RECORD_SOURCE.WORKLIST)
	})

	it("joins records that share any identifier and keeps every identifier once", () => {
		const groups = patientGroupsOf([
			{ record: patient([identifier("1001"), identifier("A-7")]), source: REGISTRY_RECORD_SOURCE.WORKLIST },
			{ record: patient([identifier("A-7")]), source: REGISTRY_RECORD_SOURCE.QUERY },
		])

		expect(groups).toHaveLength(1)
		expect(groups[0]?.identifiers).toEqual([identifier("1001"), identifier("A-7")])
	})

	it("finds the group of every identifier", () => {
		const groups = patientGroupsOf([
			{ record: patient([identifier("1001"), identifier("A-7")]), source: REGISTRY_RECORD_SOURCE.WORKLIST },
		])

		const keys = groupKeysByIdentifier(groups)

		expect(keys.get(identifierKeyOf(identifier("A-7")))).toBe(groups[0]?.key)
	})

	it("skips a record without an identifier", () => {
		expect(patientGroupsOf([{ record: patient([]), source: REGISTRY_RECORD_SOURCE.QUERY }])).toEqual([])
	})
})

describe("encounters from the worklist CAP-014-R03", () => {
	it("keeps one encounter per study and prefers the earliest scheduled step", () => {
		const unique = uniqueEncountersOf([
			encounter("2.25.10", "2026-10-06", "10:00:00"),
			encounter("2.25.10", "2026-10-06", "08:30:00"),
			encounter("2.25.11", "2026-10-06"),
		])

		expect(unique.map((item) => [item.studyInstanceUid, item.scheduledTime])).toEqual([
			["2.25.10", "08:30:00"],
			["2.25.11", undefined],
		])
	})

	it("prefers a scheduled time over an unknown one", () => {
		const unique = uniqueEncountersOf([
			encounter("2.25.12", "2026-10-06"),
			encounter("2.25.12", "2026-10-06", "07:00:00"),
		])

		expect(unique[0]?.scheduledTime).toBe("07:00:00")
	})
})

describe("encounter identifiers integrace-dicom.md 5.9", () => {
	it("sees the same Admission IDs in any order as no change", () => {
		expect(
			sameIdentifiers(
				[identifier("ADM-1", "MOU"), identifier("ADM-2")],
				[identifier("ADM-2"), identifier("ADM-1", "MOU")],
			),
		).toBe(true)
	})

	it("sees another issuer as a change", () => {
		expect(sameIdentifiers([identifier("ADM-1", "MOU")], [identifier("ADM-1", "FN")])).toBe(false)
	})

	it("sees a removed Admission ID as a change", () => {
		expect(sameIdentifiers([identifier("ADM-1")], [])).toBe(false)
	})
})
