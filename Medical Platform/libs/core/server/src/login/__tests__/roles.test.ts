import { describe, expect, it } from "vitest"
import {
	effectiveRoles,
	groupsOf,
	isAuthorizedMember,
	parseGroupToRoleMapping,
	ROLE,
	rolesFromGroups,
	sameRoles,
} from "../roles"

const MAPPING = [
	{ group: "grp-clinicians", role: ROLE.CLINICIAN },
	{ group: "grp-admins", role: ROLE.ADMINISTRATOR },
]

describe("roles from the identity provider", () => {
	it("CAP-003-S01 derives the role from the mapped group", () => {
		expect(rolesFromGroups(["grp-clinicians", "grp-other"], MAPPING)).toEqual([ROLE.CLINICIAN])
		expect(rolesFromGroups(["grp-admins", "grp-clinicians"], MAPPING)).toEqual([ROLE.ADMINISTRATOR, ROLE.CLINICIAN])
		expect(rolesFromGroups(["grp-other"], MAPPING)).toEqual([])
	})

	it("CAP-003-S07 keeps the manual role next to the group role", () => {
		expect(effectiveRoles([ROLE.CLINICIAN], [ROLE.CLINICIAN, ROLE.ADMINISTRATOR])).toEqual([
			ROLE.ADMINISTRATOR,
			ROLE.CLINICIAN,
		])
		expect(sameRoles([ROLE.CLINICIAN, ROLE.ADMINISTRATOR], [ROLE.ADMINISTRATOR, ROLE.CLINICIAN])).toBe(true)
		expect(sameRoles([ROLE.CLINICIAN], [])).toBe(false)
	})

	it("reads the mapping and the group claim defensively", () => {
		expect(
			parseGroupToRoleMapping([
				{ group: "g", role: "clinician" },
				{ group: "", role: "clinician" },
				{ group: "x", role: "boss" },
				1,
			]),
		).toEqual([{ group: "g", role: "clinician" }])
		expect(parseGroupToRoleMapping("nope")).toEqual([])
		expect(groupsOf(["a", 1, "b"])).toEqual(["a", "b"])
		expect(groupsOf("single")).toEqual(["single"])
		expect(groupsOf(undefined)).toEqual([])
	})

	it("CAP-003-S09 lets in only members of the authorized group", () => {
		expect(isAuthorizedMember(["vulna-users", "vulna-clinicians"], "vulna-users")).toBe(true)
		expect(isAuthorizedMember(["vulna-clinicians"], "vulna-users")).toBe(false)
		expect(isAuthorizedMember(["vulna-users"], undefined)).toBe(false)
	})
})
