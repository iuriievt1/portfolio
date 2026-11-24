import { describe, expect, it } from "vitest"
import { parseTrustProxyHops } from "../trust-proxy"

describe("proxies in front of the API process", () => {
	it("CAP-010-R01 counts the hops the deployment declares and ignores them when undeclared", () => {
		expect(parseTrustProxyHops("1")).toBe(1)
		expect(parseTrustProxyHops("0")).toBe(0)
		expect(parseTrustProxyHops(undefined)).toBeUndefined()
	})

	it("refuses anything but a small number", () => {
		expect(() => parseTrustProxyHops("true")).toThrow(/TRUST_PROXY/)
		expect(() => parseTrustProxyHops("-1")).toThrow(/TRUST_PROXY/)
		expect(() => parseTrustProxyHops("loopback")).toThrow(/TRUST_PROXY/)
	})
})
