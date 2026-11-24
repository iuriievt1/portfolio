import type { ClinicalActor } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { membershipAccessOf, practitionerOf, practitionerRoleOf, sameAccess, userOf } from "../actor-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const SYSTEMS = identifierSystemsOf(DEFAULT_CANONICAL_BASE)
const USER_ID = "22222222-2222-4222-8222-222222222222"
const DEPARTMENT = { id: "44444444-4444-4444-8444-444444444444", code: "KRO" }
const ACTOR: ClinicalActor = {
	userId: USER_ID,
	displayName: "Nováková Jana",
	department: DEPARTMENT,
	roles: ["clinician"],
}
const NO_ACCESS = { reference: "AccessPolicy/no-access" }
const CLINICIAN = { reference: "AccessPolicy/clinician" }
const POLICIES = { noAccess: NO_ACCESS, byRole: new Map([["clinician", CLINICIAN]]) }
const DEPARTMENT_TAG = `https://fhir.ansora.cz/vulna/tag/department|${DEPARTMENT.id}`

describe("actor resources ADR-050 bod 5", () => {
	it("CAP-021-R38 gives the Practitioner the display name only, under our identifier", () => {
		expect(practitionerOf(ACTOR, SYSTEMS)).toEqual({
			resourceType: "Practitioner",
			identifier: [{ system: "https://fhir.ansora.cz/vulna/sid/practitioner", value: USER_ID }],
			active: true,
			name: [{ text: "Nováková Jana" }],
		})
	})

	it("CAP-021-R38 names the PractitionerRole after the pair of user and department", () => {
		const role = practitionerRoleOf(
			ACTOR,
			DEPARTMENT,
			{ reference: "Practitioner/1" },
			{ reference: "Organization/2" },
			SYSTEMS,
		)

		expect(role.identifier).toEqual([
			{ system: "https://fhir.ansora.cz/vulna/sid/practitioner-role", value: `${USER_ID}.${DEPARTMENT.id}` },
		])
		expect(role.organization).toEqual({ reference: "Organization/2" })
	})

	it("NAB-479 keeps personal data out of the store's own login record", () => {
		const user = userOf(ACTOR, { reference: "Project/1" })

		expect(user).toMatchObject({ lastName: USER_ID, externalId: USER_ID })
		expect(user).not.toHaveProperty("email")
		expect(user).not.toHaveProperty("passwordHash")
		expect(JSON.stringify(user)).not.toContain("Nováková")
	})

	it("drops a trailing slash of the canonical base", () => {
		expect(identifierSystemsOf("https://fhir.example/vulna/").practitioner).toBe(
			"https://fhir.example/vulna/sid/practitioner",
		)
	})
})

describe("membership access ADR-053 bod 3, ADR-053 bod 6", () => {
	it("gives every role its policy with the department as the parameter", () => {
		expect(membershipAccessOf(ACTOR, POLICIES, SYSTEMS)).toEqual([
			{ policy: CLINICIAN, parameter: [{ name: "department_tag", valueString: DEPARTMENT_TAG }] },
		])
	})

	it("grants nothing to a user without a department", () => {
		expect(membershipAccessOf({ ...ACTOR, department: undefined }, POLICIES, SYSTEMS)).toEqual([{ policy: NO_ACCESS }])
	})

	it("grants nothing for a role the installation gave no policy", () => {
		expect(membershipAccessOf({ ...ACTOR, roles: ["unknown"] }, POLICIES, SYSTEMS)).toEqual([{ policy: NO_ACCESS }])
	})

	it("recognises access that already matches, so the membership is not rewritten", () => {
		const wanted = membershipAccessOf(ACTOR, POLICIES, SYSTEMS)
		const stored = wanted.map((entry) => ({
			...entry,
			policy: { ...entry.policy, display: "Ansora Vulna role clinician" },
		}))

		expect(sameAccess(stored, wanted)).toBe(true)
		expect(sameAccess(stored, [{ policy: NO_ACCESS }])).toBe(false)
	})
})
