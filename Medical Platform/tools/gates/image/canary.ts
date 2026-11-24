import type { Finding } from "./finding"

const GATE = "B1"
const DOMAIN_TAG = "layer:domain"
const ADAPTER_TAG = "layer:adapter"

export interface Canaries {
	modules: string[]
	adapters: string[]
}

export interface TaggedPackage {
	name: string
	tags: readonly string[]
}

export function canaries(packages: readonly TaggedPackage[], profilePackages: readonly string[]): Canaries {
	const outside = packages.filter((entry) => !profilePackages.includes(entry.name))
	return {
		modules: outside.filter((entry) => entry.tags.includes(DOMAIN_TAG)).map((entry) => entry.name),
		adapters: outside.filter((entry) => entry.tags.includes(ADAPTER_TAG)).map((entry) => entry.name),
	}
}

export function checkCanary(present: readonly string[], installed: readonly string[], found: Canaries): Finding[] {
	const findings: Finding[] = []
	if (found.modules.length === 0) {
		findings.push({
			gate: GATE,
			what: "synthetic module",
			reason: "no module outside the profile exists to prove isolation",
		})
	}
	if (found.adapters.length === 0) {
		findings.push({
			gate: GATE,
			what: "synthetic adapter",
			reason: "no adapter outside the profile exists to prove isolation",
		})
	}
	for (const name of [...found.modules, ...found.adapters]) {
		if (present.includes(name) || installed.some((spec) => spec.startsWith(`${name}@`))) {
			findings.push({ gate: GATE, what: name, reason: "synthetic package found in the image" })
		}
	}
	return findings
}
