import { describe, expect, it } from "vitest"
import {
	checkLimits,
	checkThirdPartyVulnerabilities,
	checkVulnerabilities,
	imageCounts,
	type ScanReport,
} from "../vulnerabilities"

const now = new Date("2026-09-17T12:00:00Z")

const record = {
	cve: "CVE-2026-1",
	component: "libc6",
	image_digest: "sha256:x",
	notified_at: "2026-09-17T08:00:00Z",
	notice_url: "https://example.invalid/1",
	severity_by_customer: "high",
	mitigation: "network rule",
	expires_at: "2026-09-19T08:00:00Z",
}

function report(...items: Partial<ScanReport["Results"] extends (infer R)[] | undefined ? R : never>[]): ScanReport {
	return { Results: items as ScanReport["Results"] }
}

describe("B9 vulnerability scan", () => {
	it("passes with only low and medium findings", () => {
		const scan = report({
			Vulnerabilities: [{ VulnerabilityID: "CVE-1", PkgName: "a", InstalledVersion: "1", Severity: "MEDIUM" }],
		})
		expect(checkVulnerabilities(scan, [], now)).toEqual([])
	})

	it("CAP-029-S06 fails on a fixable high or critical", () => {
		const scan = report({
			Vulnerabilities: [
				{
					VulnerabilityID: "CVE-2",
					PkgName: "multer",
					InstalledVersion: "2.2.0",
					FixedVersion: "2.3.0",
					Severity: "HIGH",
				},
			],
		})
		expect(checkVulnerabilities(scan, [record], now)).toHaveLength(1)
	})

	it("fails on an unfixed high without a notification record", () => {
		const scan = report({
			Vulnerabilities: [{ VulnerabilityID: "CVE-3", PkgName: "libc6", InstalledVersion: "2.41", Severity: "HIGH" }],
		})
		expect(checkVulnerabilities(scan, [], now)).toHaveLength(1)
	})

	it("passes an unfixed high with a valid record and fails once it expired", () => {
		const scan = report({
			Vulnerabilities: [
				{ VulnerabilityID: "CVE-2026-1", PkgName: "libc6", InstalledVersion: "2.41", Severity: "HIGH" },
			],
		})
		expect(checkVulnerabilities(scan, [record], now)).toEqual([])
		expect(checkVulnerabilities(scan, [record], new Date("2026-09-20T00:00:00Z"))).toHaveLength(1)
	})
})

describe("B10 image limits", () => {
	const scan = report(
		{
			Packages: [1, 2, 3],
			Vulnerabilities: [{ VulnerabilityID: "CVE-1", PkgName: "a", InstalledVersion: "1", Severity: "LOW" }],
		},
		{ Packages: [4] },
	)

	it("counts packages and open CVEs across results", () => {
		expect(imageCounts(scan)).toEqual({ packages: 4, open_cves: 1 })
	})

	it("CAP-029-S07 fails above a set limit and only reports when a limit is set", () => {
		expect(checkLimits(imageCounts(scan), undefined)).toEqual([])
		expect(checkLimits(imageCounts(scan), { packages: 4, open_cves: 1 })).toEqual([])
		expect(checkLimits(imageCounts(scan), { packages: 3, open_cves: 0 })).toHaveLength(2)
	})
})

describe("B9 for an official third-party image Q-135", () => {
	const fixedUpstream = report({
		Vulnerabilities: [
			{ VulnerabilityID: "CVE-2026-1", PkgName: "libc6", InstalledVersion: "1", FixedVersion: "2", Severity: "HIGH" },
		],
	})
	const exception = { ...record, image_digest: "sha256:image" }

	it("CAP-029-S24 fails a fix the image vendor has not shipped when no exception names this image", () => {
		expect(checkThirdPartyVulnerabilities(fixedUpstream, "sha256:image", [record], now)).toHaveLength(1)
	})

	it("CAP-029-S21 passes it with an exception that carries the notification, the mitigation and an expiry", () => {
		expect(checkThirdPartyVulnerabilities(fixedUpstream, "sha256:image", [exception], now)).toEqual([])
	})

	it("CAP-029-S25 refuses an exception without a mitigation or a notification and one that expired", () => {
		expect(
			checkThirdPartyVulnerabilities(fixedUpstream, "sha256:image", [{ ...exception, mitigation: "" }], now),
		).toHaveLength(1)
		expect(
			checkThirdPartyVulnerabilities(fixedUpstream, "sha256:image", [{ ...exception, notice_url: " " }], now),
		).toHaveLength(1)
		const later = new Date("2026-09-20T08:00:00Z")
		expect(checkThirdPartyVulnerabilities(fixedUpstream, "sha256:image", [exception], later)).toHaveLength(1)
	})

	it("lets low and medium findings through", () => {
		const scan = report({
			Vulnerabilities: [{ VulnerabilityID: "CVE-3", PkgName: "a", InstalledVersion: "1", Severity: "MEDIUM" }],
		})
		expect(checkThirdPartyVulnerabilities(scan, "sha256:image", [], now)).toEqual([])
	})
})
