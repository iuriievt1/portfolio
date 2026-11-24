import type { Finding } from "../image/finding"
import type { Matrix } from "./matrix"
import { STATUSES } from "./requirements-file"

export type Mode = "pull-request" | "release"

const GATE = "B12"
const REQUIREMENTS_FILE = "quality/pozadavky.yaml"
const GUARDED_STATUSES = new Set(["in_progress", "done"])

export function checkRequirementsFile(existing: string | undefined, rendered: string): Finding[] {
	if (existing === rendered) {
		return []
	}
	return [{ gate: GATE, what: REQUIREMENTS_FILE, reason: "out of date; run pnpm trace:write" }]
}

export function checkTrace(matrix: Matrix, mode: Mode): Finding[] {
	const findings: Finding[] = []
	const declared = new Set(matrix.scenarios.map((scenario) => scenario.id))
	const tested = new Set(
		matrix.scenarios.filter((scenario) => scenario.tests.length > 0).map((scenario) => scenario.id),
	)

	for (const capability of matrix.capabilities) {
		if (!(STATUSES as readonly string[]).includes(capability.status)) {
			findings.push({ gate: GATE, what: capability.id, reason: `status missing in ${REQUIREMENTS_FILE}` })
		}
	}

	for (const test of matrix.tests) {
		for (const id of test.malformed) {
			findings.push({ gate: GATE, what: `${id} (${test.path})`, reason: "malformed scenario id" })
		}
		for (const id of test.scenarios) {
			if (!declared.has(id)) {
				findings.push({ gate: GATE, what: `${id} (${test.path})`, reason: "scenario id does not exist" })
			}
		}
	}

	for (const scenario of matrix.scenarios) {
		if (scenario.tests.length > 0) {
			continue
		}
		if (mode === "release" || GUARDED_STATUSES.has(scenario.status)) {
			findings.push({
				gate: GATE,
				what: scenario.id,
				reason: `scenario without a test (${scenario.capability} ${scenario.status})`,
			})
		}
	}

	if (mode === "release") {
		for (const requirement of matrix.requirements) {
			if (requirement.evidence === "open") {
				findings.push({ gate: GATE, what: requirement.id, reason: "requirement without evidence" })
			} else if (requirement.evidence === "test" && !requirement.scenarios.some((scenario) => tested.has(scenario))) {
				findings.push({ gate: GATE, what: requirement.id, reason: "requirement without a tested scenario" })
			}
		}
	}
	return findings
}
