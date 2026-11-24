import { DEPARTMENT_CODE_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { departmentOf } from "../department"

const CLAIM = "department"

describe("departmentOf", () => {
	it("CAP-003-R07 reads the department code from the named claim without surrounding spaces", () => {
		expect(departmentOf({ [CLAIM]: " ONK " }, CLAIM)).toBe("ONK")
	})

	it("reads a whole number claim as its code", () => {
		expect(departmentOf({ [CLAIM]: 4210 }, CLAIM)).toBe("4210")
	})

	it("has no department when the claim is missing, blank or not a code", () => {
		expect(departmentOf({}, CLAIM)).toBeUndefined()
		expect(departmentOf({ [CLAIM]: "   " }, CLAIM)).toBeUndefined()
		expect(departmentOf({ [CLAIM]: ["ONK"] }, CLAIM)).toBeUndefined()
		expect(departmentOf({ [CLAIM]: 4.5 }, CLAIM)).toBeUndefined()
	})

	it("has no department when the code is longer than the contract allows", () => {
		const longest = "A".repeat(DEPARTMENT_CODE_MAX_LENGTH)
		expect(departmentOf({ [CLAIM]: `${longest}A` }, CLAIM)).toBeUndefined()
		expect(departmentOf({ [CLAIM]: longest }, CLAIM)).toBe(longest)
	})
})
