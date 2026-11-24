import { DEPARTMENT_CODE_MAX_LENGTH, ROLE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { userDepartmentSchema } from "@/features/users/lib/user-department.schema"
import { isManualOnly, sameRoles, userRolesText } from "@/features/users/lib/user-text"
import type { User } from "@/features/users/types/user.types"
import { formatList } from "@/lib/format"

function userWith(groupRoles: User["group_roles"], manualRoles: User["manual_roles"]): User {
	return {
		id: "22222222-2222-4222-8222-222222222222",
		display_name: "Jana Nováková",
		department_from_directory: false,
		roles: [...new Set([...groupRoles, ...manualRoles])].sort(),
		group_roles: groupRoles,
		manual_roles: manualRoles,
		state: "active",
	}
}

describe("roles of a user in the administration", () => {
	it("CAP-003-R03 marks the role that only the manual assignment holds", () => {
		expect(isManualOnly(ROLE.ADMINISTRATOR, [ROLE.CLINICIAN], [ROLE.ADMINISTRATOR])).toBe(true)
		expect(isManualOnly(ROLE.CLINICIAN, [ROLE.CLINICIAN], [ROLE.CLINICIAN])).toBe(false)
		expect(isManualOnly(ROLE.CLINICIAN, [ROLE.CLINICIAN], [])).toBe(false)
	})

	it("CAP-003-S07 lists both ways of assignment without a conflict", () => {
		expect(userRolesText(userWith([ROLE.CLINICIAN], [ROLE.ADMINISTRATOR]))).toBe(
			formatList(["Správce (jen ručně)", "Zdravotník"]),
		)
		expect(userRolesText(userWith([ROLE.CLINICIAN], [ROLE.CLINICIAN]))).toBe("Zdravotník")
		expect(userRolesText(userWith([], []))).toBe("bez role")
	})

	it("takes the same roles in another order as unchanged", () => {
		expect(sameRoles([ROLE.CLINICIAN, ROLE.ADMINISTRATOR], [ROLE.ADMINISTRATOR, ROLE.CLINICIAN])).toBe(true)
		expect(sameRoles([ROLE.CLINICIAN], [ROLE.CLINICIAN, ROLE.ADMINISTRATOR])).toBe(false)
		expect(sameRoles([], [])).toBe(true)
	})
})

describe("department of a user in the administration CAP-003-R07", () => {
	it("trims the code and refuses an empty or too long one", () => {
		expect(userDepartmentSchema.parse({ department: "  ONK  " })).toEqual({ department: "ONK" })
		expect(userDepartmentSchema.safeParse({ department: "   " }).success).toBe(false)
		expect(userDepartmentSchema.safeParse({ department: "A".repeat(DEPARTMENT_CODE_MAX_LENGTH + 1) }).success).toBe(
			false,
		)
	})
})
