import { describe, expect, it } from "vitest"
import type { Capability } from "../capabilities"
import { checkRequirementsFile, checkTrace } from "../check"
import { buildMatrix } from "../matrix"
import type { RequirementRecord } from "../requirements"
import { parseCapabilityStatuses, renderRequirementsFile } from "../requirements-file"
import type { TestFile } from "../tests"
import { MALFORMED_SCENARIO_ID, UNKNOWN_SCENARIO_ID } from "./fixtures"

function capability(id: string, scenarios: string[]): Capability {
	return {
		id,
		status: "current",
		rules: [],
		scenarios: scenarios.map((scenario) => ({ id: scenario, title: "", rules: [], requirements: [] })),
	}
}

function test(path: string, scenarios: string[], malformed: string[] = []): TestFile {
	return { path, scenarios, malformed }
}

const a = capability("CAP-001", ["CAP-001-S01", "CAP-001-S02"])
const b = capability("CAP-002", ["CAP-002-S01"])
const requirement: RequirementRecord = {
	id: "NAB-223",
	sentence: "Vlastní tokeny.",
	source: "nab-02a ř. 470",
	evidence: "test",
	capability: "CAP-001",
	rules: ["CAP-001-R01"],
	scenarios: ["CAP-001-S02"],
	decisions: [],
}

describe("B12 trace over a pull request", () => {
	it("CAP-029-S13 names the untested scenario of a capability in progress and the malformed id, not the planned capability", () => {
		const statuses = new Map([
			["CAP-001", "in_progress"],
			["CAP-002", "planned"],
		])
		const tests = [test("libs/a.test.ts", ["CAP-001-S01"], [MALFORMED_SCENARIO_ID])]
		const findings = checkTrace(buildMatrix([a, b], statuses, tests, []), "pull-request")
		expect(findings).toEqual([
			{ gate: "B12", what: `${MALFORMED_SCENARIO_ID} (libs/a.test.ts)`, reason: "malformed scenario id" },
			{ gate: "B12", what: "CAP-001-S02", reason: "scenario without a test (CAP-001 in_progress)" },
		])
	})

	it("fails a test that names a scenario which does not exist", () => {
		const statuses = new Map([
			["CAP-001", "planned"],
			["CAP-002", "planned"],
		])
		const findings = checkTrace(buildMatrix([a, b], statuses, [test("x.test.ts", ["CAP-009-S01"])], []), "pull-request")
		expect(findings).toEqual([{ gate: "B12", what: "CAP-009-S01 (x.test.ts)", reason: "scenario id does not exist" }])
	})

	it("passes when every scenario of a finished capability has a test", () => {
		const statuses = new Map([
			["CAP-001", "done"],
			["CAP-002", "planned"],
		])
		const tests = [test("a.test.ts", ["CAP-001-S01", "CAP-001-S02"])]
		expect(checkTrace(buildMatrix([a, b], statuses, tests, []), "pull-request")).toEqual([])
	})

	it("fails a capability without a status", () => {
		const findings = checkTrace(
			buildMatrix([a], new Map(), [test("a.test.ts", ["CAP-001-S01", "CAP-001-S02"])], []),
			"pull-request",
		)
		expect(findings.map((finding) => finding.reason)).toEqual(["status missing in quality/pozadavky.yaml"])
	})
})

describe("B12 trace at release", () => {
	const statuses = new Map([
		["CAP-001", "in_progress"],
		["CAP-002", "planned"],
	])

	it("CAP-029-S04 fails on any scenario without a test, even of a planned capability", () => {
		const tests = [test("a.test.ts", ["CAP-001-S01", "CAP-001-S02"])]
		const findings = checkTrace(buildMatrix([a, b], statuses, tests, []), "release")
		expect(findings).toEqual([
			{ gate: "B12", what: "CAP-002-S01", reason: "scenario without a test (CAP-002 planned)" },
		])
	})

	it("CAP-029-S04 fails on a test naming a scenario that does not exist", () => {
		const tests = [
			test("a.test.ts", ["CAP-001-S01", "CAP-001-S02", UNKNOWN_SCENARIO_ID]),
			test("b.test.ts", ["CAP-002-S01"]),
		]
		const findings = checkTrace(buildMatrix([a, b], statuses, tests, []), "release")
		expect(findings).toEqual([
			{ gate: "B12", what: `${UNKNOWN_SCENARIO_ID} (a.test.ts)`, reason: "scenario id does not exist" },
		])
	})

	it("fails a requirement without evidence or without a tested scenario", () => {
		const tests = [test("a.test.ts", ["CAP-001-S01"]), test("b.test.ts", ["CAP-002-S01"])]
		const open: RequirementRecord = { ...requirement, id: "TS-010", evidence: "open", scenarios: [] }
		const documented: RequirementRecord = { ...requirement, id: "TS-001", evidence: "document", scenarios: [] }
		const findings = checkTrace(buildMatrix([a, b], statuses, tests, [requirement, open, documented]), "release")
		expect(findings.map((finding) => `${finding.what}: ${finding.reason}`)).toEqual([
			"CAP-001-S02: scenario without a test (CAP-001 in_progress)",
			"NAB-223: requirement without a tested scenario",
			"TS-010: requirement without evidence",
		])
	})
})

describe("quality/pozadavky.yaml", () => {
	it("renders statuses and records and reads the statuses back", () => {
		const statuses = new Map([
			["CAP-002", "planned"],
			["CAP-001", "done"],
		])
		const rendered = renderRequirementsFile([requirement], statuses)
		expect(rendered).toContain("capabilities:\n  CAP-001: done\n  CAP-002: planned\nrequirements:\n  - id: NAB-223\n")
		expect(rendered).toContain('    sentence: "Vlastní tokeny."\n')
		expect(rendered).toContain("    scenarios: [CAP-001-S02]\n")
		expect([...parseCapabilityStatuses(rendered)]).toEqual([
			["CAP-001", "done"],
			["CAP-002", "planned"],
		])
	})

	it("fails when the committed file differs from the generated one", () => {
		expect(checkRequirementsFile("old", "new")).toHaveLength(1)
		expect(checkRequirementsFile(undefined, "new")).toHaveLength(1)
		expect(checkRequirementsFile("same", "same")).toEqual([])
	})
})
