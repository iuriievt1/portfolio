import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readJson, readJsonIfPresent } from "../gates/image/json"
import { COSIGN_IMAGE, TRIVY_IMAGE, toolVersion } from "../gates/image/tools"
import {
	databaseUpdatedAt,
	type NotificationRecord,
	type ScanReport,
	vulnerabilities,
} from "../gates/image/vulnerabilities"
import { SYFT_IMAGE } from "../gates/sbom/image-part"
import { NX, RELEASE_TOOLS } from "../gates/sbom/lockfile-part"
import type { Profile } from "../profile/model"

const ROOT = resolve(__dirname, "../..")
const IMAGE = process.env.IMAGE ?? "ansora-vulna-server:dev"
const RELEASES = "quality/vydani"
const NOTIFICATIONS = "quality/postmarket/cve-notifications.json"
const PROFILE = "profiles/mou/profile.json"
const SERVER_IMAGE_NAME = "server"
const TOOL_PACKAGES = [NX, ...RELEASE_TOOLS]

interface Step {
	id: string
	command: string[]
}

interface GateResult {
	id: string
	command: string
	status: "passed" | "failed"
	log: string
}

interface OpenCve {
	image: string
	id: string
	component: string
	installed: string
	fixed?: string
	severity: string
	notice_url?: string
}

const STEPS: Step[] = [
	{ id: "profile", command: ["pnpm", "profile:build"] },
	{ id: "B15", command: ["pnpm", "gate:boundaries"] },
	{ id: "B16", command: ["pnpm", "gate:contract"] },
	{ id: "B12", command: ["pnpm", "gate:trace:release"] },
	{ id: "vazby", command: ["node", "tools/kontroly/vazby-kontrola.mjs", "--prisne"] },
	{ id: "image", command: ["pnpm", "image:build"] },
	{ id: "B1-B11", command: ["pnpm", "gate:image"] },
	{ id: "B4-B8", command: ["pnpm", "gate:sbom"] },
	{ id: "mobile", command: ["pnpm", "scan:mobile"] },
]
const ARTIFACTS: [string, string][] = [
	["dist/sbom", "sbom"],
	["dist/trace", "matice"],
	["dist/profile", "profil"],
	["dist/image", "brany"],
]

function git(...args: string[]): string {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
}

function releaseVersion(): string {
	try {
		return git("describe", "--tags", "--exact-match")
	} catch {
		throw new Error("a release is built from a tagged revision; tag it first or pass --to <dir>")
	}
}

function run(step: Step, directory: string): GateResult {
	const result = spawnSync(step.command[0] as string, step.command.slice(1), { cwd: ROOT, encoding: "utf8" })
	const log = join("brany", `${step.id}.log`)
	writeFileSync(join(directory, log), `${result.stdout ?? ""}${result.stderr ?? ""}`)
	return { id: step.id, command: step.command.join(" "), status: result.status === 0 ? "passed" : "failed", log }
}

function toolVersions(): Record<string, string> {
	const versions: Record<string, string> = {
		node: process.version,
		pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
	}
	for (const name of TOOL_PACKAGES) {
		versions[name] = readJson<{ version: string }>(join(ROOT, "node_modules", name, "package.json")).version
	}
	versions.cosign = toolVersion(COSIGN_IMAGE)
	versions.trivy = toolVersion(TRIVY_IMAGE)
	versions.syft = toolVersion(SYFT_IMAGE)
	return versions
}

function openCves(
	imageName: string,
	report: ScanReport | undefined,
	notifications: readonly NotificationRecord[],
): OpenCve[] {
	if (report === undefined) {
		return []
	}
	return vulnerabilities(report).map((vulnerability) => {
		const record = notifications.find(
			(candidate) => candidate.cve === vulnerability.VulnerabilityID && candidate.component === vulnerability.PkgName,
		)
		const cve: OpenCve = {
			image: imageName,
			id: vulnerability.VulnerabilityID,
			component: vulnerability.PkgName,
			installed: vulnerability.InstalledVersion,
			severity: vulnerability.Severity,
		}
		if (vulnerability.FixedVersion) {
			cve.fixed = vulnerability.FixedVersion
		}
		if (record !== undefined) {
			cve.notice_url = record.notice_url
		}
		return cve
	})
}

function markdown(record: Record<string, unknown>, gates: GateResult[], cves: OpenCve[], artifacts: string[]): string {
	const lines = [
		"# Záznam o vydání",
		"",
		"| | |",
		"|---|---|",
		`| Verze | ${record.version} |`,
		`| Revize | ${record.revision} |`,
		`| Čas | ${record.created_at} |`,
		`| Obraz | ${(record.image as { id: string }).id} |`,
		`| Základní obraz | ${(record.image as { base: string }).base} |`,
		`| Databáze zranitelností | ${record.vulnerability_database} |`,
		"",
		"## Nástroje",
		"",
		"| Nástroj | Verze |",
		"|---|---|",
		...Object.entries(record.tools as Record<string, string>).map(([name, version]) => `| ${name} | ${version} |`),
		"",
		"## Brány",
		"",
		"| Brána | Příkaz | Výsledek | Log |",
		"|---|---|---|---|",
		...gates.map((gate) => `| ${gate.id} | \`${gate.command}\` | ${gate.status} | ${gate.log} |`),
		"",
		"## Otevřené CVE v obrazech",
		"",
		"| Obraz | CVE | Komponenta | Verze | Oprava | Závažnost | Oznámení |",
		"|---|---|---|---|---|---|---|",
		...cves.map(
			(cve) =>
				`| ${cve.image} | ${cve.id} | ${cve.component} | ${cve.installed} | ${cve.fixed ?? "—"} | ${cve.severity} | ${cve.notice_url ?? "—"} |`,
		),
		"",
		"## Artefakty",
		"",
		...artifacts.map((artifact) => `- ${artifact}`),
		"",
	]
	return lines.join("\n")
}

function listFiles(directory: string, prefix = ""): string[] {
	return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? listFiles(directory, join(prefix, entry.name)) : [join(prefix, entry.name)],
	)
}

const toIndex = process.argv.indexOf("--to")
const tag = toIndex === -1 ? releaseVersion() : git("describe", "--tags", "--always", "--dirty")
const output = toIndex === -1 ? join(ROOT, RELEASES, tag) : resolve(ROOT, process.argv[toIndex + 1] ?? "")
mkdirSync(join(output, "brany"), { recursive: true })

const results = STEPS.map((step) => {
	const result = run(step, output)
	process.stdout.write(`${result.id}: ${result.status}\n`)
	return result
})
for (const [source, target] of ARTIFACTS) {
	if (existsSync(join(ROOT, source))) {
		cpSync(join(ROOT, source), join(output, target), { recursive: true })
	}
}

const image = JSON.parse(
	execFileSync("docker", ["image", "inspect", IMAGE, "--format", "{{json .}}"], { encoding: "utf8" }),
) as { Id: string; Created: string }
const profile = readJson<Profile>(join(ROOT, PROFILE))
const base = profile.baseImage
const records = readJsonIfPresent<NotificationRecord[]>(join(ROOT, NOTIFICATIONS)) ?? []
const issues = [
	...openCves(SERVER_IMAGE_NAME, readJsonIfPresent<ScanReport>(join(output, "brany/trivy.json")), records),
	...[...(profile.thirdPartyImages ?? []), ...(profile.builtImages ?? [])].flatMap((entry) =>
		openCves(entry.name, readJsonIfPresent<ScanReport>(join(output, `brany/trivy-${entry.name}.json`)), records),
	),
]
const data = {
	version: tag,
	revision: git("rev-parse", "HEAD"),
	created_at: new Date().toISOString(),
	image: { reference: IMAGE, id: image.Id, created: image.Created, base: `${base.image}@${base.digest}` },
	tools: toolVersions(),
	vulnerability_database: databaseUpdatedAt(),
	gates: results,
	open_cves: issues,
}
writeFileSync(join(output, "zaznam.json"), `${JSON.stringify(data, null, "\t")}\n`)
const files = listFiles(output).sort()
writeFileSync(join(output, "zaznam.md"), markdown(data, results, issues, files))

const failed = results.filter((gate) => gate.status === "failed")
process.stdout.write(
	`release record ${tag}: ${results.length} gates, ${failed.length} failed, ${issues.length} open CVEs; ${output}\n`,
)
if (failed.length > 0) {
	process.exitCode = 1
}
