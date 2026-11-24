import type { Request } from "express"
import { describe, expect, it } from "vitest"
import { isCrossSiteRequest } from "../cross-site-request"

function request(method: string, headers: Record<string, string>, host = "admin.mou.invalid"): Request {
	return { method, host, get: (name: string) => headers[name.toLowerCase()] } as unknown as Request
}

describe("cross-site request", () => {
	it("CAP-004-R05 refuses a change another site made the browser send", () => {
		expect(isCrossSiteRequest(request("POST", { "sec-fetch-site": "cross-site" }))).toBe(true)
		expect(isCrossSiteRequest(request("DELETE", { "sec-fetch-site": "same-site" }))).toBe(true)
		expect(isCrossSiteRequest(request("POST", { origin: "https://evil.invalid" }))).toBe(true)
	})

	it("lets the administration's own changes and every read through", () => {
		expect(isCrossSiteRequest(request("POST", { "sec-fetch-site": "same-origin" }))).toBe(false)
		expect(isCrossSiteRequest(request("POST", { origin: "https://admin.mou.invalid" }))).toBe(false)
		expect(isCrossSiteRequest(request("GET", { "sec-fetch-site": "cross-site" }))).toBe(false)
		expect(isCrossSiteRequest(request("POST", {}))).toBe(false)
	})
})
