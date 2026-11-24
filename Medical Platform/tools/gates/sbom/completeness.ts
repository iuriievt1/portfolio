import type { Finding } from "../image/finding"
import { type Bom, type Component, componentKeys, LOCATION_PROPERTY, license } from "./cyclonedx"
import type { BuildTools } from "./lockfile-part"

const GATE = "B5"
const DIGEST_GATE = "B7"
const CPE_VERSION_FIELD = 5

export interface OsPackage {
	name: string
	version: string
}

export interface Runtime {
	name: string
	version: string
}

export interface ImageFacts {
	osPackages: readonly OsPackage[]
	npmPackages: readonly string[]
	runtime: Runtime
	baseDigest: string | undefined
}

export interface SupplementEntry {
	name: string
	version: string
	type: Component["type"]
	purl?: string
	cpe?: string
	license?: string
	source?: string
	description?: string
	location: string
}

interface IdentifiedEntry extends SupplementEntry {
	purl: string
	cpe: string
	license: string
	source: string
}

function isIdentified(entry: SupplementEntry): entry is IdentifiedEntry {
	return (
		entry.purl !== undefined && entry.cpe !== undefined && entry.license !== undefined && entry.source !== undefined
	)
}

function namesItsVersion(entry: IdentifiedEntry): boolean {
	return entry.purl.endsWith(`@${entry.version}`) && entry.cpe.split(":")[CPE_VERSION_FIELD] === entry.version
}

// ADR-011 ř. 49
function sourceArchiveOf(entry: Pick<SupplementEntry, "name" | "version">): string {
	return `${entry.name}-${entry.version}.tar.gz`
}

function supplementComponentOf(entry: IdentifiedEntry, sourceSha256: string): Component {
	return {
		"bom-ref": entry.purl,
		type: entry.type,
		name: entry.name,
		version: entry.version,
		purl: entry.purl,
		cpe: entry.cpe,
		description: entry.description,
		licenses: license(entry.license),
		externalReferences: [
			{ type: "source-distribution", url: entry.source, hashes: [{ alg: "SHA-256", content: sourceSha256 }] },
		],
		properties: [{ name: LOCATION_PROPERTY, value: entry.location }],
	}
}

// ADR-011 ř. 49
export function supplementComponents(
	entries: readonly SupplementEntry[],
	sourceChecksums: ReadonlyMap<string, string>,
): {
	components: Component[]
	findings: Finding[]
} {
	const components: Component[] = []
	const findings: Finding[] = []
	for (const entry of entries) {
		const what = `${entry.name}@${entry.version}`
		if (!isIdentified(entry)) {
			findings.push({ gate: GATE, what, reason: "manual SBOM entry without purl, cpe, license or source" })
			continue
		}
		if (!namesItsVersion(entry)) {
			findings.push({ gate: GATE, what, reason: "manual SBOM entry whose purl or cpe names another version" })
			continue
		}
		const sourceSha256 = sourceChecksums.get(sourceArchiveOf(entry))
		if (sourceSha256 === undefined) {
			findings.push({ gate: GATE, what, reason: "manual SBOM entry without a recorded source archive" })
			continue
		}
		components.push(supplementComponentOf(entry, sourceSha256))
	}
	return { components, findings }
}

export function checkImageCompleteness(bom: Bom, facts: ImageFacts): Finding[] {
	const findings: Finding[] = []
	const keys = componentKeys(bom)

	for (const { name, version } of facts.osPackages) {
		if (!keys.has(`${name}@${version}`)) {
			findings.push({
				gate: GATE,
				what: `${name}@${version}`,
				reason: "operating system package missing from the SBOM",
			})
		}
	}
	for (const spec of facts.npmPackages) {
		if (!keys.has(spec)) {
			findings.push({ gate: GATE, what: spec, reason: "lockfile package missing from the SBOM" })
		}
	}

	const runtime = bom.components.find(
		(component) => component.name === facts.runtime.name && component.version === facts.runtime.version,
	)
	if (runtime === undefined) {
		findings.push({
			gate: GATE,
			what: `${facts.runtime.name}@${facts.runtime.version}`,
			reason: "runtime missing from the SBOM",
		})
	} else if (runtime.purl === undefined || runtime.cpe === undefined) {
		findings.push({ gate: GATE, what: `${runtime.name}@${runtime.version}`, reason: "runtime without purl or cpe" })
	}

	if (facts.baseDigest === undefined) {
		findings.push({ gate: DIGEST_GATE, what: "base image", reason: "base image without digest" })
	} else if (!bom.components.some((component) => component.version === facts.baseDigest)) {
		findings.push({ gate: DIGEST_GATE, what: facts.baseDigest, reason: "base image digest missing from the SBOM" })
	}
	return findings
}

export function checkBuildTools(bom: Bom, tools: BuildTools): Finding[] {
	const findings: Finding[] = []
	const keys = componentKeys(bom)
	if (tools.nx === "" || !keys.has(`nx@${tools.nx}`)) {
		findings.push({ gate: GATE, what: `nx@${tools.nx}`, reason: "Nx missing from the SBOM" })
	}
	for (const [name, version] of tools.plugins) {
		if (version === "" || !keys.has(`${name}@${version}`)) {
			findings.push({ gate: GATE, what: `${name}@${version}`, reason: "Nx plugin missing from the SBOM" })
		}
	}
	for (const [name, version] of tools.releaseTools) {
		if (version === "" || !keys.has(`${name}@${version}`)) {
			findings.push({ gate: GATE, what: `${name}@${version}`, reason: "build tool missing from the SBOM" })
		}
	}
	for (const [name, version] of tools.native) {
		if (!keys.has(`${name}@${version}`)) {
			findings.push({
				gate: GATE,
				what: `${name}@${version}`,
				reason: "native binary of a build tool missing from the SBOM",
			})
		}
	}
	return findings
}

export function checkDirectDependencies(bom: Bom, direct: ReadonlyMap<string, string>): Finding[] {
	const keys = componentKeys(bom)
	const findings: Finding[] = []
	for (const [name, version] of direct) {
		if (!keys.has(`${name}@${version}`)) {
			findings.push({ gate: GATE, what: `${name}@${version}`, reason: "direct dependency missing from the SBOM" })
		}
	}
	return findings
}
