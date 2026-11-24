import { DECISION_ID, idsIn, REQUIREMENT_ID, RULE_ID } from "./ids"

export interface Rule {
	id: string
	requirements: string[]
	decisions: string[]
}

export interface Scenario {
	id: string
	title: string
	rules: string[]
	requirements: string[]
}

export interface Capability {
	id: string
	status: string
	rules: Rule[]
	scenarios: Scenario[]
}

const HEADER_ID = /^id: (CAP-\d{3})$/m
const HEADER_STATUS = /^status: (\S+)$/m
const RULE_LINE = /^- (CAP-\d{3}-R\d{2}) /
const CONTINUATION = /^ {2}\S/
const SCENARIO_LINE = /^#### (CAP-\d{3}-S\d{2}) — (.*)$/

function ruleFrom(id: string, text: string): Rule {
	return { id, requirements: idsIn(text, REQUIREMENT_ID), decisions: idsIn(text, DECISION_ID) }
}

export function parseCapability(markdown: string): Capability | undefined {
	const id = HEADER_ID.exec(markdown)?.[1]
	if (id === undefined) {
		return undefined
	}
	const rules: Rule[] = []
	const scenarios: Scenario[] = []
	let rule: { id: string; text: string } | undefined
	let scenario: Scenario | undefined
	let body = ""

	const closeRule = (): void => {
		if (rule !== undefined) {
			rules.push(ruleFrom(rule.id, rule.text))
			rule = undefined
		}
	}
	const closeScenario = (): void => {
		if (scenario !== undefined) {
			scenario.rules = idsIn(body, RULE_ID)
			scenario.requirements = idsIn(body, REQUIREMENT_ID)
			scenarios.push(scenario)
			scenario = undefined
			body = ""
		}
	}

	for (const line of markdown.split("\n")) {
		const ruleMatch = RULE_LINE.exec(line)
		if (ruleMatch?.[1] !== undefined) {
			closeRule()
			rule = { id: ruleMatch[1], text: line }
			continue
		}
		if (rule !== undefined && CONTINUATION.test(line)) {
			rule.text += ` ${line.trim()}`
			continue
		}
		closeRule()

		const scenarioMatch = SCENARIO_LINE.exec(line)
		if (scenarioMatch?.[1] !== undefined && scenarioMatch[2] !== undefined) {
			closeScenario()
			scenario = { id: scenarioMatch[1], title: scenarioMatch[2].trim(), rules: [], requirements: [] }
			continue
		}
		if (line.startsWith("#")) {
			closeScenario()
			continue
		}
		if (scenario !== undefined) {
			body += `${line}\n`
		}
	}
	closeRule()
	closeScenario()

	return { id, status: HEADER_STATUS.exec(markdown)?.[1] ?? "", rules, scenarios }
}
