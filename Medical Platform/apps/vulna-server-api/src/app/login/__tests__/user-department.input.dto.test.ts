import { DEPARTMENT_CODE_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { userDepartmentSchema } from "../dto/user-department.input.dto"

describe("userDepartmentSchema", () => {
	it("accepts a department code without surrounding spaces", () => {
		expect(userDepartmentSchema.parse({ department: " ONK " })).toEqual({ department: "ONK" })
	})

	it("refuses a blank, too long or missing code and any other field", () => {
		expect(userDepartmentSchema.safeParse({ department: "  " }).success).toBe(false)
		expect(userDepartmentSchema.safeParse({ department: "A".repeat(DEPARTMENT_CODE_MAX_LENGTH + 1) }).success).toBe(
			false,
		)
		expect(userDepartmentSchema.safeParse({}).success).toBe(false)
		expect(userDepartmentSchema.safeParse({ department: "ONK", name: "Onkologie" }).success).toBe(false)
	})
})
