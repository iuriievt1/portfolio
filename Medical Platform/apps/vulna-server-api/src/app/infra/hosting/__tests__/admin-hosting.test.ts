import { describe, expect, it } from "vitest"
import { isAppRoute } from "../admin-hosting"

describe("admin app routes", () => {
	it("serves the app for page routes", () => {
		expect(isAppRoute("GET", "/")).toBe(true)
		expect(isAppRoute("GET", "/devices")).toBe(true)
		expect(isAppRoute("GET", "/devices/42")).toBe(true)
	})

	it("leaves the API alone", () => {
		expect(isAppRoute("GET", "/health/live")).toBe(false)
		expect(isAppRoute("GET", "/metrics")).toBe(false)
		expect(isAppRoute("GET", "/api/admin/v1/devices")).toBe(false)
	})

	it("leaves files and other methods alone", () => {
		expect(isAppRoute("GET", "/assets/app.js")).toBe(false)
		expect(isAppRoute("POST", "/devices")).toBe(false)
	})
})
