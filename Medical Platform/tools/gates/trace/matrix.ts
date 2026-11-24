import type { Capability } from "./capabilities"
import type { RequirementRecord } from "./requirements"
import type { TestFile } from "./tests"

export interface ScenarioRow {
	id: string
	capability: string
	status: string
	title: string
	tests: string[]
}

export interface CapabilityRow {
	id: string
	status: string
	scenarios: number
	tested: number
}

export interface Matrix {
	capabilities: CapabilityRow[]
	scenarios: ScenarioRow[]
	requirements: RequirementRecord[]
	tests: TestFile[]
}

const CURRENT = "current"

export function buildMatrix(
	capabilities: readonly Capability[],
	statuses: ReadonlyMap<string, string>,
	tests: readonly TestFile[],
	requirements: readonly RequirementRecord[],
): Matrix {
	const testsByScenario = new Map<string, string[]>()
	for (const test of tests) {
		for (const scenario of test.scenarios) {
			testsByScenario.set(scenario, [...(testsByScenario.get(scenario) ?? []), test.path])
		}
	}
	const scenarios: ScenarioRow[] = []
	const rows: CapabilityRow[] = []
	for (const capability of capabilities.filter((entry) => entry.status === CURRENT)) {
		const status = statuses.get(capability.id) ?? ""
		let tested = 0
		for (const scenario of capability.scenarios) {
			const found = testsByScenario.get(scenario.id) ?? []
			tested += found.length > 0 ? 1 : 0
			scenarios.push({ id: scenario.id, capability: capability.id, status, title: scenario.title, tests: found })
		}
		rows.push({ id: capability.id, status, scenarios: capability.scenarios.length, tested })
	}
	return { capabilities: rows, scenarios, requirements: [...requirements], tests: [...tests] }
}

export function renderMatrixMarkdown(matrix: Matrix): string {
	const lines = ["# Matice sledovatelnosti", "", "| Schopnost | Stav | Scénářů | S testem |", "|---|---|---|---|"]
	for (const row of matrix.capabilities) {
		lines.push(`| ${row.id} | ${row.status} | ${row.scenarios} | ${row.tested} |`)
	}
	lines.push("", "| Scénář | Testy |", "|---|---|")
	for (const scenario of matrix.scenarios) {
		lines.push(`| ${scenario.id} | ${scenario.tests.join(", ") || "—"} |`)
	}
	lines.push("", "| Požadavek | Doklad | Schopnost | Scénáře |", "|---|---|---|---|")
	for (const requirement of matrix.requirements) {
		lines.push(
			`| ${requirement.id} | ${requirement.evidence} | ${requirement.capability ?? "—"} | ${requirement.scenarios.join(", ") || "—"} |`,
		)
	}
	return `${lines.join("\n")}\n`
}
