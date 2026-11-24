export const SPEC_VERSION = "1.7"
export const MANUFACTURER = "veevoy"
export const LOCATION_PROPERTY = "syft:location:0:path"

// CycloneDX 1.7 licenseChoice
export type Licenses = { license: { id?: string; name?: string } }[] | [{ expression: string }]

// SPDX 2.3 annex D
const SPDX_IDENTIFIER = /^[A-Za-z0-9.+-]+$/
const SPDX_EXPRESSION = /^\(?[A-Za-z0-9.+-]+(\s+(AND|OR|WITH)\s+\(?[A-Za-z0-9.+-]+\)?)+\)?$/

export interface Property {
	name: string
	value: string
}

export interface Hash {
	alg: "SHA-256"
	content: string
}

export interface ExternalReference {
	type: "source-distribution"
	url: string
	hashes: Hash[]
}

// CycloneDX 1.7 commit
export interface Commit {
	uid: string
	url: string
}

// CycloneDX 1.7 pedigree
export interface Pedigree {
	ancestors: Omit<Component, "bom-ref">[]
	commits: Commit[]
	notes: string
}

// CycloneDX 1.7 evidence
export interface Evidence {
	occurrences: { location: string }[]
}

export interface Component {
	"bom-ref": string
	type: "application" | "library" | "container" | "operating-system" | "file"
	name: string
	version: string
	purl?: string
	cpe?: string
	description?: string
	licenses?: Licenses
	hashes?: Hash[]
	supplier?: { name: string }
	manufacturer?: { name: string }
	pedigree?: Pedigree
	evidence?: Evidence
	externalReferences?: ExternalReference[]
	properties?: Property[]
}

export interface Dependency {
	ref: string
	dependsOn?: string[]
}

export interface Tool {
	type: "application"
	name: string
	version: string
}

export interface Bom {
	$schema: string
	bomFormat: "CycloneDX"
	specVersion: string
	serialNumber?: string
	version: number
	metadata: {
		timestamp: string
		tools: { components: Tool[] }
		component: Component
	}
	components: Component[]
	dependencies?: Dependency[]
	vulnerabilities?: unknown[]
}

export function licenseValue(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value
	}
	if (typeof value === "object" && value !== null && "type" in value) {
		return String((value as { type: unknown }).type)
	}
	return undefined
}

export function license(value: unknown): Licenses {
	const text = licenseValue(value)
	if (text === undefined || text === "") {
		return []
	}
	if (SPDX_IDENTIFIER.test(text)) {
		return [{ license: { id: text } }]
	}
	return SPDX_EXPRESSION.test(text) ? [{ expression: text }] : [{ license: { name: text } }]
}

export function licenseText(component: Component): string {
	const licenses: readonly ({ license?: { id?: string; name?: string } } | { expression: string })[] =
		component.licenses ?? []
	return licenses
		.map((entry) => ("expression" in entry ? entry.expression : (entry.license?.id ?? entry.license?.name ?? "")))
		.join(" ")
}

export function npmPurl(name: string, version: string): string {
	return `pkg:npm/${name.replace("@", "%40")}@${version}`
}

export function purlKey(reference: string): string {
	return reference.split("?")[0] as string
}

export function componentKeys(bom: Bom): Set<string> {
	const keys = new Set<string>()
	for (const component of bom.components) {
		keys.add(`${component.name}@${component.version}`)
		if (component.purl !== undefined) {
			keys.add(purlKey(component.purl))
		}
	}
	return keys
}

export function newBom(product: Component, tools: Tool[], components: Component[], now: Date): Bom {
	return {
		$schema: `http://cyclonedx.org/schema/bom-${SPEC_VERSION}.schema.json`,
		bomFormat: "CycloneDX",
		specVersion: SPEC_VERSION,
		version: 1,
		metadata: { timestamp: now.toISOString(), tools: { components: tools }, component: product },
		components,
	}
}
