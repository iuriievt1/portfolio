import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { Finding } from "../image/finding"
import { type Capability, parseCapability } from "./capabilities"
import { checkRequirementsFile, checkTrace, type Mode } from "./check"
import { parseCompliance } from "./compliance"
import { buildMatrix, renderMatrixMarkdown } from "./matrix"
import { parseRegistry } from "./registry"
import { buildRequirements } from "./requirements"
import { DEFAULT_STATUS, parseCapabilityStatuses, renderRequirementsFile } from "./requirements-file"
import { findTestFiles, readTestFile, testGlobs } from "./tests"

const ROOT = resolve(__dirname, "../../..")
const REGISTRIES = ["docs/spec/_prace/req-ts.md", "docs/spec/_prace/req-nab.md", "docs/spec/_prace/req-sml.md"]
const CAPABILITIES = "docs/capabilities"
const COMPLIANCE = "docs/spec/soulad-zd.md"
const README = "docs/README.md"
const REQUIREMENTS_FILE = "quality/pozadavky.yaml"
const OUTPUT = "dist/trace"
const CURRENT = "current"

const mode: Mode = process.argv.includes("--release") ? "release" : "pull-request"
const write = process.argv.includes("--write")

function read(path: string): string {
	return readFileSync(join(ROOT, path), "utf8")
}

function readCapabilities(): Capability[] {
	return readdirSync(join(ROOT, CAPABILITIES))
		.filter((name) => /^CAP-\d{3}-.*\.md$/.test(name))
		.sort()
		.map((name) => parseCapability(read(join(CAPABILITIES, name))))
		.filter((capability): capability is Capability => capability !== undefined)
}

const capabilities = readCapabilities()
const requirements = REGISTRIES.flatMap((path) => parseRegistry(read(path)))
const coverage = parseCompliance(read(COMPLIANCE))
const records = buildRequirements(requirements, capabilities, coverage)

const existing = existsSync(join(ROOT, REQUIREMENTS_FILE)) ? read(REQUIREMENTS_FILE) : undefined
const statuses = parseCapabilityStatuses(existing ?? "")
for (const capability of capabilities) {
	if (capability.status === CURRENT && !statuses.has(capability.id)) {
		statuses.set(capability.id, DEFAULT_STATUS)
	}
}
const rendered = renderRequirementsFile(records, statuses)
const findings: Finding[] = []
if (write) {
	writeFileSync(join(ROOT, REQUIREMENTS_FILE), rendered)
	process.stdout.write(`${REQUIREMENTS_FILE}: ${records.length} requirements written\n`)
} else {
	findings.push(...checkRequirementsFile(existing, rendered))
}

const globs = testGlobs(read(README))
const tests = findTestFiles(ROOT, globs).map((path) => readTestFile(ROOT, path))
const matrix = buildMatrix(capabilities, statuses, tests, records)
mkdirSync(join(ROOT, OUTPUT), { recursive: true })
writeFileSync(join(ROOT, OUTPUT, "matrix.json"), `${JSON.stringify(matrix, null, "\t")}\n`)
writeFileSync(join(ROOT, OUTPUT, "matrix.md"), renderMatrixMarkdown(matrix))

findings.push(...checkTrace(matrix, mode))

const tested = matrix.scenarios.filter((scenario) => scenario.tests.length > 0).length
const byEvidence = { test: 0, document: 0, open: 0 }
for (const record of records) {
	byEvidence[record.evidence] += 1
}
process.stdout.write(
	`B12 trace (${mode}): ${matrix.capabilities.length} capabilities, ${matrix.scenarios.length} scenarios, ${tested} with a test in ${tests.length} test files (${globs.join(" ")})\n`,
)
process.stdout.write(
	`B12 requirements: ${records.length} in v1, ${byEvidence.test} by test, ${byEvidence.document} by document, ${byEvidence.open} open; matrix in ${OUTPUT}\n`,
)

if (findings.length === 0) {
	process.stdout.write("B12 trace: clean\n")
} else {
	process.stderr.write(`\nB12 trace: ${findings.length} violations\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.gate}  ${finding.what}\n    ${finding.reason}\n\n`)
	}
	process.exitCode = 1
}
