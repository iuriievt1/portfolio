export const REQUIREMENT_ID = /\b(?:TS|NAB|SML)-\d{3}\b/g
export const RULE_ID = /\bCAP-\d{3}-R\d{2}\b/g
export const SCENARIO_ID = /\bCAP-\d{3}-S\d{2}\b/g
export const DECISION_ID = /\bADR-\d{3}\b/g
const LOOSE_SCENARIO_ID = /\bCAP-\d+-S\d+\b/g
const WELL_FORMED_SCENARIO_ID = /^CAP-\d{3}-S\d{2}$/

export function idsIn(text: string, pattern: RegExp): string[] {
	return [...new Set(text.match(pattern) ?? [])]
}

export function malformedScenarioIds(text: string): string[] {
	return idsIn(text, LOOSE_SCENARIO_ID).filter((id) => !WELL_FORMED_SCENARIO_ID.test(id))
}
