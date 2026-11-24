import { execFileSync } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Finding } from "./finding"
import { runDocker, TRIVY_IMAGE } from "./tools"

const GATE = "B9"
const BLOCKING_SEVERITIES = ["CRITICAL", "HIGH"]

export interface Vulnerability {
	VulnerabilityID: string
	PkgName: string
	InstalledVersion: string
	FixedVersion?: string
	Severity: string
}

export interface ScanReport {
	Results?: { Packages?: unknown[]; Vulnerabilities?: Vulnerability[] }[]
}

export interface NotificationRecord {
	cve: string
	component: string
	image_digest: string
	notified_at: string
	notice_url: string
	severity_by_customer: string
	mitigation: string
	expires_at: string
}

export interface ImageCounts {
	packages: number
	open_cves: number
}

export function scanImage(image: string): ScanReport {
	const directory = mkdtempSync(join(tmpdir(), "vulna-scan-"))
	try {
		execFileSync("docker", ["save", "-o", join(directory, "image.tar"), image])
		const result = runDocker([
			"-v",
			`${directory}:/scan`,
			"-v",
			"vulna-trivy-cache:/root/.cache",
			TRIVY_IMAGE,
			"image",
			"--input",
			"/scan/image.tar",
			"--scanners",
			"vuln",
			"--pkg-types",
			"os,library",
			"--format",
			"json",
			"--output",
			"/scan/report.json",
		])
		if (result.status !== 0) {
			throw new Error(`trivy failed: ${result.output.trim().split("\n").pop()}`)
		}
		return JSON.parse(readFileSync(join(directory, "report.json"), "utf8")) as ScanReport
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
}

export function scanSbom(sbom: string): ScanReport {
	const directory = mkdtempSync(join(tmpdir(), "vulna-scan-"))
	try {
		copyFileSync(sbom, join(directory, "sbom.json"))
		const result = runDocker([
			"-v",
			`${directory}:/scan`,
			"-v",
			"vulna-trivy-cache:/root/.cache",
			TRIVY_IMAGE,
			"sbom",
			"/scan/sbom.json",
			"--scanners",
			"vuln",
			"--format",
			"json",
			"--output",
			"/scan/report.json",
		])
		if (result.status !== 0) {
			throw new Error(`trivy failed: ${result.output.trim().split("\n").pop()}`)
		}
		return JSON.parse(readFileSync(join(directory, "report.json"), "utf8")) as ScanReport
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
}

export function parseDatabaseUpdatedAt(versionJson: string): string {
	const parsed = JSON.parse(versionJson) as { VulnerabilityDB?: { UpdatedAt?: string } }
	const updatedAt = parsed.VulnerabilityDB?.UpdatedAt
	if (updatedAt === undefined) {
		throw new Error("vulnerability database not available")
	}
	return updatedAt
}

export function databaseUpdatedAt(): string {
	const result = runDocker(["-v", "vulna-trivy-cache:/root/.cache", TRIVY_IMAGE, "version", "--format", "json"])
	if (result.status !== 0) {
		throw new Error(`trivy failed: ${result.output.trim().split("\n").pop()}`)
	}
	return parseDatabaseUpdatedAt(result.output)
}

export function vulnerabilities(report: ScanReport): Vulnerability[] {
	return (report.Results ?? []).flatMap((result) => result.Vulnerabilities ?? [])
}

export function imageCounts(report: ScanReport): ImageCounts {
	return {
		packages: (report.Results ?? []).reduce((sum, result) => sum + (result.Packages?.length ?? 0), 0),
		open_cves: vulnerabilities(report).length,
	}
}

function blockingVulnerabilities(report: ScanReport): Vulnerability[] {
	return vulnerabilities(report).filter((vulnerability) => BLOCKING_SEVERITIES.includes(vulnerability.Severity))
}

function findingSubject(vulnerability: Vulnerability): string {
	return `${vulnerability.VulnerabilityID} ${vulnerability.PkgName} ${vulnerability.InstalledVersion}`
}

export function checkVulnerabilities(report: ScanReport, records: readonly NotificationRecord[], now: Date): Finding[] {
	const findings: Finding[] = []
	for (const vulnerability of blockingVulnerabilities(report)) {
		const what = findingSubject(vulnerability)
		if (vulnerability.FixedVersion) {
			findings.push({ gate: GATE, what, reason: `${vulnerability.Severity}, fixed in ${vulnerability.FixedVersion}` })
			continue
		}
		const record = records.find(
			(candidate) => candidate.cve === vulnerability.VulnerabilityID && candidate.component === vulnerability.PkgName,
		)
		if (record === undefined) {
			findings.push({
				gate: GATE,
				what,
				reason: `${vulnerability.Severity} without fix and without a notification record`,
			})
			continue
		}
		if (new Date(record.expires_at) <= now) {
			findings.push({ gate: GATE, what, reason: `notification record expired ${record.expires_at}` })
		}
	}
	return findings
}

function exceptionOf(
	vulnerability: Vulnerability,
	digest: string,
	records: readonly NotificationRecord[],
): NotificationRecord | undefined {
	return records.find(
		(candidate) =>
			candidate.cve === vulnerability.VulnerabilityID &&
			candidate.component === vulnerability.PkgName &&
			candidate.image_digest === digest,
	)
}

// Q-135, CAP-029-R30, CAP-029-R31
export function checkThirdPartyVulnerabilities(
	report: ScanReport,
	digest: string,
	records: readonly NotificationRecord[],
	now: Date,
): Finding[] {
	const findings: Finding[] = []
	for (const vulnerability of blockingVulnerabilities(report)) {
		const what = findingSubject(vulnerability)
		const record = exceptionOf(vulnerability, digest, records)
		if (record === undefined) {
			findings.push({
				gate: GATE,
				what,
				reason: vulnerability.FixedVersion
					? `${vulnerability.Severity}, fixed upstream in ${vulnerability.FixedVersion}, without an exception for this image`
					: `${vulnerability.Severity} without fix and without a notification record`,
			})
			continue
		}
		if (record.mitigation.trim() === "" || record.notice_url.trim() === "") {
			findings.push({ gate: GATE, what, reason: "exception without a mitigation or a notification" })
			continue
		}
		if (new Date(record.expires_at) <= now) {
			findings.push({ gate: GATE, what, reason: `exception expired ${record.expires_at}` })
		}
	}
	return findings
}

export function checkLimits(counts: ImageCounts, limits: ImageCounts | undefined): Finding[] {
	if (limits === undefined) {
		return []
	}
	const findings: Finding[] = []
	if (counts.packages > limits.packages) {
		findings.push({ gate: "B10", what: `${counts.packages} packages`, reason: `limit is ${limits.packages}` })
	}
	if (counts.open_cves > limits.open_cves) {
		findings.push({ gate: "B10", what: `${counts.open_cves} open CVEs`, reason: `limit is ${limits.open_cves}` })
	}
	return findings
}
