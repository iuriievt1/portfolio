import { describe, expect, it } from "vitest"
import { isPermission, PERMISSION, PERMISSIONS } from "../permissions"

describe("permission catalog", () => {
	it("knows every permission it lists", () => {
		expect(PERMISSIONS.every(isPermission)).toBe(true)
		expect(isPermission(PERMISSION.DEVICES_MANAGE)).toBe(true)
		expect(isPermission(PERMISSION.AUDIT_EXPORT)).toBe(true)
		expect(isPermission(PERMISSION.MONITORING_MANAGE)).toBe(true)
		expect(isPermission(PERMISSION.DRAFTS_MANAGE)).toBe(true)
		expect(isPermission(PERMISSION.ACQUISITIONS_READ)).toBe(true)
	})

	it("refuses a permission it does not list", () => {
		expect(isPermission("audit.delete")).toBe(false)
		expect(isPermission("")).toBe(false)
	})
})
