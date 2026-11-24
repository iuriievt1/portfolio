import type { Finding } from "../image/finding"
import { type Bom, type Component, componentKeys, license } from "./cyclonedx"

const GATE = "B5"

// quality/vydani/sbom-mobile-embedded.json
export interface EmbeddedComponent {
	name: string
	version: string
	purl?: string
	cpe?: string
	license?: string
	source?: string
	source_sha256?: string
	package: string
	package_version: string
	path: string
}

type IdentifiedComponent = Required<EmbeddedComponent>

function isIdentified(entry: EmbeddedComponent): entry is IdentifiedComponent {
	return [entry.purl, entry.cpe, entry.license, entry.source, entry.source_sha256].every(
		(value) => value !== undefined && value !== "",
	)
}

function embeddedComponent(entry: IdentifiedComponent): Component {
	return {
		"bom-ref": entry.purl,
		type: "library",
		name: entry.name,
		version: entry.version,
		purl: entry.purl,
		cpe: entry.cpe,
		licenses: license(entry.license),
		evidence: { occurrences: [{ location: `${entry.package}/${entry.path}` }] },
		externalReferences: [
			{ type: "source-distribution", url: entry.source, hashes: [{ alg: "SHA-256", content: entry.source_sha256 }] },
		],
	}
}

export function embeddedComponents(entries: readonly EmbeddedComponent[]): Component[] {
	return entries.filter(isIdentified).map(embeddedComponent)
}

// NAB-662, vydani-sbom-a-brany.md 4.2
export function checkEmbeddedComponents(
	entries: readonly EmbeddedComponent[],
	bom: Bom,
	isInstalled: (packageName: string, path: string) => boolean,
): Finding[] {
	const keys = componentKeys(bom)
	const findings: Finding[] = []
	for (const entry of entries) {
		const what = `${entry.name}@${entry.version}`
		const carrier = `${entry.package}@${entry.package_version}`
		if (!isIdentified(entry)) {
			findings.push({ gate: GATE, what, reason: "embedded component entry without purl, cpe, license, source or hash" })
			continue
		}
		if (!keys.has(carrier)) {
			findings.push({ gate: GATE, what, reason: `package ${carrier} carrying it is missing from the SBOM` })
			continue
		}
		if (!isInstalled(entry.package, entry.path)) {
			findings.push({ gate: GATE, what, reason: `${entry.package}/${entry.path} is not installed` })
		}
	}
	return findings
}
