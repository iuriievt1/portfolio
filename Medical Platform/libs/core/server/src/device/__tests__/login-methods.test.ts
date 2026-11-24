import { describe, expect, it } from "vitest"
import { CONFIGURATION_KEY } from "../../configuration/keys"
import {
	effectiveLoginMethods,
	enabledLoginMethods,
	explicitOverrides,
	isLoginMethodOverrides,
	LOGIN_METHOD_SOURCE,
	sameOverrides,
} from "../login-methods"

function installation(card: boolean, qr: boolean, pin: boolean, barcode = false): ReadonlyMap<string, unknown> {
	return new Map<string, unknown>([
		[CONFIGURATION_KEY.LOGIN_METHOD_CARD, card],
		[CONFIGURATION_KEY.LOGIN_METHOD_QR, qr],
		[CONFIGURATION_KEY.LOGIN_METHOD_BARCODE, barcode],
		[CONFIGURATION_KEY.LOGIN_METHOD_PIN, pin],
	])
}

describe("effectiveLoginMethods", () => {
	it("keeps the full sign-in always enabled and takes the quick methods from the instance", () => {
		const methods = effectiveLoginMethods({ installation: installation(true, false, true, true) })

		expect(methods).toEqual([
			{ method: "oidc", enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION },
			{ method: "card", enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION },
			{ method: "qr", enabled: false, source: LOGIN_METHOD_SOURCE.INSTALLATION },
			{ method: "barcode", enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION },
			{ method: "pin", enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION },
		])
	})

	it("CAP-012-S27 lets the device override the group in both directions", () => {
		const levels = { installation: installation(true, true, true), group: { card: false }, device: { card: true } }

		expect(effectiveLoginMethods(levels)).toContainEqual({
			method: "card",
			enabled: true,
			source: LOGIN_METHOD_SOURCE.DEVICE,
		})
		expect(effectiveLoginMethods({ ...levels, device: { card: false } })).toContainEqual({
			method: "card",
			enabled: false,
			source: LOGIN_METHOD_SOURCE.DEVICE,
		})
	})

	it("CAP-001-S09 inherits a method the group turned off when the device sets none", () => {
		const methods = enabledLoginMethods(
			effectiveLoginMethods({ installation: installation(true, true, true), group: { card: false }, device: {} }),
		)
		expect(methods).not.toContain("card")
		expect(methods).toContain("oidc")
	})

	it("CAP-001-S35 enables the QR code on the one device that turns it on over its group", () => {
		const group = { qr: false }
		const own = enabledLoginMethods(
			effectiveLoginMethods({ installation: installation(true, true, true), group, device: { qr: true } }),
		)
		const others = enabledLoginMethods(
			effectiveLoginMethods({ installation: installation(true, true, true), group, device: {} }),
		)
		expect(own).toContain("qr")
		expect(others).not.toContain("qr")
	})

	it("CAP-006-S11 takes the group value where the device sets none", () => {
		const methods = effectiveLoginMethods({
			installation: installation(true, true, true),
			group: { qr: false },
			device: { qr: null },
		})

		expect(methods).toContainEqual({ method: "qr", enabled: false, source: LOGIN_METHOD_SOURCE.GROUP })
	})

	it("CAP-012-S28 never turns the full sign-in off", () => {
		const methods = effectiveLoginMethods({
			installation: installation(false, false, false),
			group: { card: false, qr: false, pin: false },
		})

		expect(methods[0]).toEqual({ method: "oidc", enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION })
	})
})

describe("isLoginMethodOverrides", () => {
	it("accepts only the quick methods with a boolean or no value", () => {
		expect(isLoginMethodOverrides({})).toBe(true)
		expect(isLoginMethodOverrides({ card: true, qr: null, barcode: false })).toBe(true)
		expect(isLoginMethodOverrides({ oidc: false })).toBe(false)
		expect(isLoginMethodOverrides({ card: "yes" })).toBe(false)
		expect(isLoginMethodOverrides(null)).toBe(false)
	})
})

describe("explicitOverrides", () => {
	it("keeps only the methods the level sets and drops the inherited ones", () => {
		expect(explicitOverrides({ card: false, qr: null, pin: true })).toEqual({ card: false, pin: true })
		expect(explicitOverrides({ card: null, qr: null, pin: null })).toEqual({})
	})

	it("treats an inherited method and a missing one as the same override", () => {
		expect(sameOverrides({ card: false, qr: null }, { card: false })).toBe(true)
		expect(sameOverrides({ card: false }, { card: true })).toBe(false)
		expect(sameOverrides({}, { pin: false })).toBe(false)
	})
})
