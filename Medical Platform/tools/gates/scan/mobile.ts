import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { Finding } from "../image/finding"
import { readJson, readJsonIfPresent } from "../image/json"
import { TRIVY_IMAGE, toolVersion } from "../image/tools"
import {
	checkVulnerabilities,
	databaseUpdatedAt,
	imageCounts,
	type NotificationRecord,
	scanSbom,
} from "../image/vulnerabilities"
import type { Tool } from "../sbom/cyclonedx"
import { parseLockfile } from "../sbom/lockfile"
import { buildMobileBom } from "../sbom/mobile"
import { readStore } from "../sbom/store"

const ROOT = resolve(__dirname, "../../..")
const NOTIFICATIONS = join(ROOT, "quality/postmarket/cve-notifications.json")

const version = execFileSync("git", ["describe", "--tags", "--always", "--dirty"], {
	cwd: ROOT,
	encoding: "utf8",
}).trim()
const generator: Tool = {
	type: "application",
	name: "@ansora/tools",
	version: readJson<{ version: string }>(join(ROOT, "tools/package.json")).version,
}
const lockfile = parseLockfile(readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8"))
const bom = buildMobileBom(ROOT, lockfile, readStore(join(ROOT, "node_modules")), version, generator, new Date())

const directory = mkdtempSync(join(tmpdir(), "vulna-mobile-"))
let findings: Finding[] = []
try {
	const path = join(directory, "mobile.cdx.json")
	writeFileSync(path, JSON.stringify(bom))
	const report = scanSbom(path)
	const counts = imageCounts(report)
	findings = checkVulnerabilities(report, readJsonIfPresent<NotificationRecord[]>(NOTIFICATIONS) ?? [], new Date())
	process.stdout.write(
		`mobile scan: ${bom.components.length} components, ${counts.open_cves} open CVEs, trivy ${toolVersion(TRIVY_IMAGE)}, database ${databaseUpdatedAt()}\n`,
	)
} finally {
	rmSync(directory, { recursive: true, force: true })
}

if (findings.length === 0) {
	process.stdout.write("mobile scan: clean\n")
} else {
	process.stderr.write(`\nmobile scan: ${findings.length} violations\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.what}\n    ${finding.reason}\n\n`)
	}
	process.exitCode = 1
}
