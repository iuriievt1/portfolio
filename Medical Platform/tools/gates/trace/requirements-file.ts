import type { RequirementRecord } from "./requirements"

export const STATUSES = ["planned", "in_progress", "done"] as const
export type Status = (typeof STATUSES)[number]
export const DEFAULT_STATUS: Status = "planned"

const STATUS_LINE = /^ {2}(CAP-\d{3}): (\S+)$/

function quote(value: string): string {
	return JSON.stringify(value)
}

function list(values: readonly string[]): string {
	return `[${values.join(", ")}]`
}

export function parseCapabilityStatuses(yaml: string): Map<string, string> {
	const statuses = new Map<string, string>()
	let inBlock = false
	for (const line of yaml.split("\n")) {
		if (/^\S/.test(line)) {
			inBlock = line === "capabilities:"
			continue
		}
		const match = STATUS_LINE.exec(line)
		if (inBlock && match?.[1] !== undefined && match[2] !== undefined) {
			statuses.set(match[1], match[2])
		}
	}
	return statuses
}

export function renderRequirementsFile(
	records: readonly RequirementRecord[],
	statuses: ReadonlyMap<string, string>,
): string {
	const lines = ["capabilities:"]
	for (const [capability, status] of [...statuses].sort()) {
		lines.push(`  ${capability}: ${status}`)
	}
	lines.push("requirements:")
	for (const record of records) {
		lines.push(`  - id: ${record.id}`)
		lines.push(`    sentence: ${quote(record.sentence)}`)
		lines.push(`    source: ${quote(record.source)}`)
		lines.push(`    evidence: ${record.evidence}`)
		if (record.capability !== undefined) {
			lines.push(`    capability: ${record.capability}`)
		}
		if (record.home !== undefined) {
			lines.push(`    home: ${quote(record.home)}`)
		}
		lines.push(`    rules: ${list(record.rules)}`)
		lines.push(`    scenarios: ${list(record.scenarios)}`)
		lines.push(`    decisions: ${list(record.decisions)}`)
	}
	return `${lines.join("\n")}\n`
}
