import { describe, expect, it } from "vitest"
import { parseInstalledPackages, parseOwners } from "../apk"
import { checkProvenance, restrictReport } from "../built-image"

// CAP-029-R30, CAP-029-S20
describe("provenance of a built image", () => {
	const base = new Map([
		["/etc/passwd", "p"],
		["/etc/ssl/certs/ca-certificates.crt", "c"],
	])
	const source = new Map([
		["/usr/local/bin/valkey-server", "v"],
		["/usr/lib/libssl.so.3", "s"],
		["/lib/ld-musl-aarch64.so.1", "m"],
		["/bin/sh", "sh"],
	])

	it("lists the files copied from the source image, by content when usrmerge moved them", () => {
		const built = new Map([
			["/etc/passwd", "p"],
			["/etc/ssl/certs/ca-certificates.crt", "c"],
			["/usr/lib/libssl.so.3", "s"],
			["/usr/lib/ld-musl-aarch64.so.1", "m"],
			["/usr/local/bin/valkey-server", "v"],
		])
		const provenance = checkProvenance(built, base, source)
		expect(provenance.findings).toEqual([])
		expect(provenance.carried).toEqual([
			{ file: "/usr/lib/ld-musl-aarch64.so.1", sourceFile: "/lib/ld-musl-aarch64.so.1" },
			{ file: "/usr/lib/libssl.so.3", sourceFile: "/usr/lib/libssl.so.3" },
			{ file: "/usr/local/bin/valkey-server", sourceFile: "/usr/local/bin/valkey-server" },
		])
	})

	it("names a file that matches neither image and a base file that changed", () => {
		const built = new Map([
			["/etc/passwd", "changed"],
			["/usr/local/bin/valkey-server", "v"],
			["/usr/local/bin/helper", "h"],
		])
		const provenance = checkProvenance(built, base, source)
		expect(provenance.findings.map((finding) => finding.what)).toEqual(["/etc/passwd", "/usr/local/bin/helper"])
		expect(provenance.carried).toEqual([
			{ file: "/usr/local/bin/valkey-server", sourceFile: "/usr/local/bin/valkey-server" },
		])
	})
})

describe("scan of the source image restricted to the carried packages", () => {
	it("keeps only vulnerabilities of the packages whose files the built image carries", () => {
		const report = restrictReport(
			{
				Results: [
					{
						Vulnerabilities: [
							{ VulnerabilityID: "CVE-1", PkgName: "libssl3", InstalledVersion: "3.5.8-r0", Severity: "HIGH" },
							{ VulnerabilityID: "CVE-2", PkgName: "busybox", InstalledVersion: "1.37", Severity: "HIGH" },
						],
					},
				],
			},
			new Set(["libssl3", "musl"]),
		)
		expect(report.Results?.[0]?.Vulnerabilities?.map((vulnerability) => vulnerability.VulnerabilityID)).toEqual([
			"CVE-1",
		])
	})
})

describe("apk output", () => {
	it("parses installed packages with their version, architecture and license", () => {
		const packages = parseInstalledPackages(
			[
				"libssl3-3.5.8-r0 aarch64 {openssl} (Apache-2.0) [installed]",
				"musl-utils-1.2.6-r2 aarch64 {musl} (MIT AND BSD-2-Clause AND GPL-2.0-or-later) [installed]",
				"WARNING: opening from cache",
			].join("\n"),
		)
		expect(packages).toEqual([
			{ name: "libssl3", version: "3.5.8-r0", architecture: "aarch64", license: "Apache-2.0" },
			{
				name: "musl-utils",
				version: "1.2.6-r2",
				architecture: "aarch64",
				license: "MIT AND BSD-2-Clause AND GPL-2.0-or-later",
			},
		])
	})

	it("maps owned files to their package and leaves unowned files out", () => {
		const owners = parseOwners(
			[
				"ERROR: /usr/local/bin/valkey-server: Could not find owner package",
				"/usr/lib/libssl.so.3 is owned by libssl3-3.5.8-r0",
				"/lib/ld-musl-aarch64.so.1 is owned by musl-1.2.6-r2",
			].join("\n"),
		)
		expect([...owners]).toEqual([
			["/usr/lib/libssl.so.3", "libssl3"],
			["/lib/ld-musl-aarch64.so.1", "musl"],
		])
	})
})
