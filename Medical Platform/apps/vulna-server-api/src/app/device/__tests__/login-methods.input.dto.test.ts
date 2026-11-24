import { describe, expect, it } from "vitest"
import { groupLoginMethodsSchema, loginMethodOverridesSchema } from "../dto/login-methods.input.dto"

describe("login method overrides", () => {
	it("CAP-012-R32 accepts an override of every quick method including the barcode", () => {
		const overrides = { card: false, qr: null, barcode: false, pin: true }

		expect(loginMethodOverridesSchema.parse(overrides)).toEqual(overrides)
		expect(groupLoginMethodsSchema.parse({ login_methods: overrides, clear_device_overrides: true })).toEqual({
			login_methods: overrides,
			clear_device_overrides: true,
		})
	})

	it("CAP-012-R26 refuses an override of the full account login", () => {
		expect(loginMethodOverridesSchema.safeParse({ oidc: false }).success).toBe(false)
	})
})
