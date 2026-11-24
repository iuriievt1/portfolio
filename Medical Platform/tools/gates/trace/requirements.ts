import type { Capability } from "./capabilities"
import type { Coverage } from "./compliance"
import type { Requirement } from "./registry"

export type Evidence = "test" | "document" | "open"

export interface RequirementRecord {
	id: string
	sentence: string
	source: string
	evidence: Evidence
	capability?: string
	home?: string
	rules: string[]
	scenarios: string[]
	decisions: string[]
}

const DELIVERED_VERSION = "v1"
const CURRENT = "current"

function push(map: Map<string, Set<string>>, key: string, value: string): void {
	const values = map.get(key) ?? new Set<string>()
	values.add(value)
	map.set(key, values)
}

function evidenceOf(coverage: Coverage | undefined): Evidence {
	if (coverage?.state === "mimo chování") {
		return "document"
	}
	if (coverage?.state === "pokryto") {
		return "test"
	}
	return "open"
}

export function buildRequirements(
	requirements: readonly Requirement[],
	capabilities: readonly Capability[],
	coverage: ReadonlyMap<string, Coverage>,
): RequirementRecord[] {
	const rulesByRequirement = new Map<string, Set<string>>()
	const decisionsByRule = new Map<string, Set<string>>()
	const scenariosByRule = new Map<string, Set<string>>()
	const scenariosByRequirement = new Map<string, Set<string>>()

	for (const capability of capabilities.filter((entry) => entry.status === CURRENT)) {
		for (const rule of capability.rules) {
			for (const requirement of rule.requirements) {
				push(rulesByRequirement, requirement, rule.id)
			}
			for (const decision of rule.decisions) {
				push(decisionsByRule, rule.id, decision)
			}
		}
		for (const scenario of capability.scenarios) {
			for (const rule of scenario.rules) {
				push(scenariosByRule, rule, scenario.id)
			}
			for (const requirement of scenario.requirements) {
				push(scenariosByRequirement, requirement, scenario.id)
			}
		}
	}

	return requirements
		.filter((requirement) => requirement.version === DELIVERED_VERSION)
		.map((requirement) => {
			const rules = [...(rulesByRequirement.get(requirement.id) ?? [])].sort()
			const scenarios = new Set(scenariosByRequirement.get(requirement.id) ?? [])
			const decisions = new Set<string>()
			for (const rule of rules) {
				for (const scenario of scenariosByRule.get(rule) ?? []) {
					scenarios.add(scenario)
				}
				for (const decision of decisionsByRule.get(rule) ?? []) {
					decisions.add(decision)
				}
			}
			const found = coverage.get(requirement.id)
			const record: RequirementRecord = {
				id: requirement.id,
				sentence: requirement.sentence,
				source: requirement.source,
				evidence: evidenceOf(found),
				rules,
				scenarios: [...scenarios].sort(),
				decisions: [...decisions].sort(),
			}
			if (found?.capability !== undefined) {
				record.capability = found.capability
			}
			if (found?.home !== undefined) {
				record.home = found.home
			}
			return record
		})
}
