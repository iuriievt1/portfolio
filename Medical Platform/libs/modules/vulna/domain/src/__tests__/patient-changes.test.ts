import { PATIENT_SEX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { PatientIdentifier, PatientRecord } from "../ports/patient-directory.port"
import { demographicsDiffer, hasIdentifierChanges, identifierChangesOf } from "../registry/patient-changes"

const SYSTEM = "urn:oid:2.25.1"

function identifier(value: string): PatientIdentifier {
	return { system: SYSTEM, value, issuer: undefined }
}

const CACHED: PatientRecord = {
	identifiers: [identifier("1001")],
	familyName: "Svobodová",
	givenName: "Marie",
	birthDate: "1950-02-01",
	sex: PATIENT_SEX.FEMALE,
}

describe("demographics of a cached patient datovy-model.md 7", () => {
	it("sees no change when the registry sends the same values", () => {
		expect(demographicsDiffer(CACHED, { ...CACHED })).toBe(false)
	})

	it("sees a changed name, birth date or sex", () => {
		expect(demographicsDiffer(CACHED, { ...CACHED, familyName: "Nováková" })).toBe(true)
		expect(demographicsDiffer(CACHED, { ...CACHED, birthDate: "1950-02-02" })).toBe(true)
		expect(demographicsDiffer(CACHED, { ...CACHED, sex: undefined })).toBe(true)
	})
})

describe("identifiers of a cached patient CAP-024-R07", () => {
	it("adds a new identifier and keeps the existing one", () => {
		const changes = identifierChangesOf(
			[{ identifier: identifier("1001"), isCurrent: true, isFromRegistry: true }],
			[identifier("1001"), identifier("A-7")],
		)

		expect(changes).toEqual({ added: [identifier("A-7")], restored: [], retired: [] })
	})

	it("retires an identifier the registry stopped sending instead of deleting it", () => {
		const changes = identifierChangesOf(
			[
				{ identifier: identifier("1001"), isCurrent: true, isFromRegistry: true },
				{ identifier: identifier("A-7"), isCurrent: true, isFromRegistry: true },
			],
			[identifier("1001")],
		)

		expect(changes.retired).toEqual([identifier("A-7")])
	})

	it("restores a retired identifier that came back", () => {
		const changes = identifierChangesOf(
			[{ identifier: identifier("A-7"), isCurrent: false, isFromRegistry: true }],
			[identifier("A-7")],
		)

		expect(changes.restored).toEqual([identifier("A-7")])
	})

	it("never retires an identifier the registry did not give", () => {
		const changes = identifierChangesOf(
			[{ identifier: identifier("V-1"), isCurrent: true, isFromRegistry: false }],
			[identifier("1001")],
		)

		expect(changes.retired).toEqual([])
	})

	it("reports whether anything changed", () => {
		expect(hasIdentifierChanges({ added: [], restored: [], retired: [] })).toBe(false)
		expect(hasIdentifierChanges({ added: [identifier("1")], restored: [], retired: [] })).toBe(true)
	})
})
