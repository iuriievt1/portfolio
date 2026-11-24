import { CLINICAL_RECORD_ADAPTER, MEDPLUM_PACKAGES } from "../rules"
import type { Finding } from "./finding"

const GATE = "B2"

export interface InventoryInput {
	present: readonly string[]
	allowed: readonly string[]
	required: readonly string[]
	installed: readonly string[]
	lockfile: ReadonlySet<string>
	banned: readonly string[]
}

export function parsePnpmDirectory(directory: string): string | undefined {
	const match = /^(@?[^@]+)@([^_]+)/.exec(directory)
	if (match?.[1] === undefined || match[2] === undefined) {
		return undefined
	}
	return `${match[1].replace("+", "/")}@${match[2]}`
}

export function lockfilePackages(lockfile: string): Set<string> {
	const keys = new Set<string>()
	let inPackages = false
	for (const line of lockfile.split("\n")) {
		if (/^\S/.test(line)) {
			inPackages = line.startsWith("packages:")
			continue
		}
		const match = /^ {2}'?([^\s':]+)'?:$/.exec(line)
		if (inPackages && match?.[1] !== undefined) {
			keys.add(match[1])
		}
	}
	return keys
}

function matchesPattern(name: string, pattern: string): boolean {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
	return new RegExp(`^${escaped}$`).test(name)
}

export function checkInventory(input: InventoryInput): Finding[] {
	const findings: Finding[] = []

	for (const name of input.present) {
		if (!input.allowed.includes(name)) {
			findings.push({ gate: GATE, what: name, reason: "workspace package outside the profile" })
		}
	}

	for (const name of input.required) {
		if (!input.present.includes(name)) {
			findings.push({ gate: GATE, what: name, reason: "package of the server closure is missing" })
		}
	}

	for (const directory of input.installed) {
		const spec = parsePnpmDirectory(directory)
		if (spec === undefined) {
			continue
		}
		if (!input.lockfile.has(spec)) {
			findings.push({ gate: GATE, what: spec, reason: "installed package is not in pnpm-lock.yaml" })
		}
		const name = spec.slice(0, spec.lastIndexOf("@"))
		for (const pattern of input.banned) {
			if (matchesPattern(name, pattern)) {
				findings.push({ gate: GATE, what: spec, reason: `banned package (${pattern})` })
			}
		}
	}

	return findings
}

// B2, ADR-054 bod 3
export function bannedPackagesOf(profileBanned: readonly string[], adapters: readonly string[]): string[] {
	return adapters.includes(CLINICAL_RECORD_ADAPTER) ? [...profileBanned] : [...profileBanned, MEDPLUM_PACKAGES]
}

// ADR-017, ADR-003 ř. 26
export function checkEntryPoints(
	files: readonly string[],
	entryPoints: readonly { name: string; path: string }[],
): Finding[] {
	const present = new Set(files)
	return entryPoints
		.filter(({ path }) => !present.has(path))
		.map(({ name, path }) => ({ gate: GATE, what: name, reason: `entry point ${path} is missing from the image` }))
}
