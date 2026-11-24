import { describe, expect, it } from "vitest"
import { isValidAddress, resolveBootstrap } from "../bootstrap"

const release = {
	serverUrl: "https://vulna.hospital.example",
	oidcDiscoveryUrl: "https://idp.hospital.example/.well-known/openid-configuration",
}

describe("bootstrap addresses of the mobile app", () => {
	it("CAP-012-S20 takes the address from managed configuration over the release", () => {
		const result = resolveBootstrap({ server_url: "https://vulna-b.hospital.example" }, release)
		expect(result).toEqual({
			ok: true,
			serverUrl: "https://vulna-b.hospital.example",
			oidcDiscoveryUrl: release.oidcDiscoveryUrl,
			sources: { serverUrl: "managed", oidcDiscoveryUrl: "release" },
		})
	})

	it("CAP-012-S21 reports the missing address when managed configuration carries an invalid one", () => {
		expect(resolveBootstrap({ server_url: "vulna.hospital.example" }, release)).toEqual({
			ok: false,
			missing: ["serverUrl"],
		})
		expect(resolveBootstrap({ server_url: "http://vulna.hospital.example" }, release)).toEqual({
			ok: false,
			missing: ["serverUrl"],
		})
	})

	it("CAP-012-S21 reports every address the release does not carry", () => {
		expect(resolveBootstrap({}, { serverUrl: null, oidcDiscoveryUrl: null })).toEqual({
			ok: false,
			missing: ["serverUrl", "oidcDiscoveryUrl"],
		})
	})

	it("CAP-012-S22 uses the release address without managed configuration and knows only these two sources", () => {
		const result = resolveBootstrap({}, release)
		expect(result).toEqual({
			ok: true,
			serverUrl: release.serverUrl,
			oidcDiscoveryUrl: release.oidcDiscoveryUrl,
			sources: { serverUrl: "release", oidcDiscoveryUrl: "release" },
		})
	})

	it("accepts http only when a development build allows it", () => {
		expect(isValidAddress("http://localhost:3000")).toBe(false)
		expect(isValidAddress("http://localhost:3000", { allowHttp: true })).toBe(true)
		expect(isValidAddress("https://vulna.hospital.example")).toBe(true)
		expect(isValidAddress(null)).toBe(false)
	})
})
