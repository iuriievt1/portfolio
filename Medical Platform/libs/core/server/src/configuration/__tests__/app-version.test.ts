import { describe, expect, it } from "vitest"
import {
	type AppVersion,
	appVersionOfHeader,
	compareVersions,
	isAppVersionSupported,
	parseAppVersionHeader,
	parseVersion,
} from "../app-version"

function version(text: string): AppVersion {
	const parsed = parseVersion(text)
	if (parsed === undefined) {
		throw new Error(`invalid version ${text}`)
	}
	return parsed
}

describe("minimum app version", () => {
	it("CAP-012-S11 rejects a version older than the minimum and accepts the minimum and newer", () => {
		const minimum = version("1.4.0")
		expect(isAppVersionSupported(version("1.3.9"), minimum)).toBe(false)
		expect(isAppVersionSupported(version("0.9.9"), minimum)).toBe(false)
		expect(isAppVersionSupported(version("1.4.0"), minimum)).toBe(true)
		expect(isAppVersionSupported(version("1.4.1"), minimum)).toBe(true)
		expect(isAppVersionSupported(version("2.0.0"), minimum)).toBe(true)
	})

	it("accepts every version when no minimum is configured", () => {
		expect(isAppVersionSupported(version("0.0.1"), undefined)).toBe(true)
	})

	it("compares the parts as numbers", () => {
		expect(compareVersions(version("1.10.0"), version("1.9.0"))).toBeGreaterThan(0)
		expect(compareVersions(version("1.0.10"), version("1.0.9"))).toBeGreaterThan(0)
		expect(compareVersions(version("1.2.3"), version("1.2.3"))).toBe(0)
	})

	it("reads the version from the header shaped version+assembly", () => {
		expect(parseAppVersionHeader("1.0.0+142")).toEqual({ major: 1, minor: 0, patch: 0 })
		expect(parseAppVersionHeader("2.7.15+build.3")).toEqual({ major: 2, minor: 7, patch: 15 })
	})

	it("refuses a header without an assembly or with a malformed version", () => {
		for (const header of ["", "1.0.0", "1.0+142", "1.0.0+", "01.0.0+1", "1.0.0+1+2", "1.0.0+a b", "abc"]) {
			expect(parseAppVersionHeader(header)).toBeUndefined()
			expect(appVersionOfHeader(header)).toBeUndefined()
		}
	})

	it("CAP-008-R12 keeps the version of the header without its assembly", () => {
		expect(appVersionOfHeader("1.0.0+142")).toBe("1.0.0")
		expect(appVersionOfHeader("2.7.15+build.3")).toBe("2.7.15")
	})
})
