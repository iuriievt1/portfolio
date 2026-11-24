import { LOGIN_NAME_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { loginNameOfBarcode } from "../employee-barcode"

describe("login name on the employee card barcode", () => {
	it("reads the whole content without surrounding spaces", () => {
		expect(loginNameOfBarcode(" JNOVAKOVA ")).toBe("JNOVAKOVA")
	})

	it("has no login name when the code is blank or longer than a login name can be", () => {
		expect(loginNameOfBarcode("   ")).toBeUndefined()
		expect(loginNameOfBarcode("A".repeat(LOGIN_NAME_MAX_LENGTH + 1))).toBeUndefined()
		expect(loginNameOfBarcode("A".repeat(LOGIN_NAME_MAX_LENGTH))).toBe("A".repeat(LOGIN_NAME_MAX_LENGTH))
	})
})
