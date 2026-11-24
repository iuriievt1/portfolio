import type { Finding } from "./finding"

const GATE = "B3"

export type ProcessName = "api" | "worker"

export interface AdapterManifest {
	name: string
	processes: readonly string[]
	outboundCommunication: readonly { target: string }[]
}

// B3, vydani-sbom-a-brany.md 2.1, ADR-054 bod 3, 4
const PROCESS_TARGETS: Record<ProcessName, readonly string[]> = {
	api: ["identity-provider", "log-management", "database", "clinical-record-store"],
	worker: ["pacs", "log-management", "database", "clinical-record-store"],
}

export function allowlistFromManifests(manifests: readonly AdapterManifest[]): Record<ProcessName, string[]> {
	const allowlist: Record<ProcessName, Set<string>> = { api: new Set(["database"]), worker: new Set(["database"]) }
	for (const manifest of manifests) {
		for (const process of manifest.processes) {
			if (process !== "api" && process !== "worker") {
				continue
			}
			for (const outbound of manifest.outboundCommunication) {
				allowlist[process].add(outbound.target)
			}
		}
	}
	return { api: [...allowlist.api].sort(), worker: [...allowlist.worker].sort() }
}

export function checkAllowlist(allowlist: Record<ProcessName, readonly string[]>): Finding[] {
	const findings: Finding[] = []
	for (const process of Object.keys(PROCESS_TARGETS) as ProcessName[]) {
		for (const target of allowlist[process]) {
			if (!PROCESS_TARGETS[process].includes(target)) {
				findings.push({
					gate: GATE,
					what: `${process} -> ${target}`,
					reason: "outbound target not allowed for this process",
				})
			}
		}
	}
	return findings
}
