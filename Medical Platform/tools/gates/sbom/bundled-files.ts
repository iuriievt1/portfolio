import type { Finding } from "../image/finding"
import { type Component, LOCATION_PROPERTY, license } from "./cyclonedx"

const GATE = "B5"
const WILDCARD = "*"
const PATH_SEGMENT = "[^/]+"
const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/g

// quality/vydani/sbom-files.json
export interface BundledFile {
	name: string
	version: string
	purl?: string
	cpe?: string
	license?: string
	source?: string
	source_sha256?: string
	location: string
	sha256?: string
}

type IdentifiedFile = Required<BundledFile>

export interface BundledFiles {
	components: Component[]
	findings: Finding[]
}

function isIdentified(entry: BundledFile): entry is IdentifiedFile {
	return [entry.purl, entry.cpe, entry.license, entry.source, entry.source_sha256, entry.sha256].every(
		(value) => value !== undefined && value !== "",
	)
}

function locationPattern(location: string): RegExp {
	const literals = location.split(WILDCARD).map((part) => part.replace(REGEX_SYNTAX, "\\$&"))
	return new RegExp(`^${literals.join(PATH_SEGMENT)}$`)
}

function fileComponent(entry: IdentifiedFile, file: string): Component {
	return {
		"bom-ref": entry.purl,
		type: "file",
		name: entry.name,
		version: entry.version,
		purl: entry.purl,
		cpe: entry.cpe,
		licenses: license(entry.license),
		hashes: [{ alg: "SHA-256", content: entry.sha256 }],
		externalReferences: [
			{ type: "source-distribution", url: entry.source, hashes: [{ alg: "SHA-256", content: entry.source_sha256 }] },
		],
		properties: [{ name: LOCATION_PROPERTY, value: file }],
	}
}

// NAB-662, vydani-sbom-a-brany.md 4.2
export function bundledFileComponents(
	entries: readonly BundledFile[],
	files: readonly string[],
	sha256Of: (file: string) => string | undefined,
): BundledFiles {
	const components: Component[] = []
	const findings: Finding[] = []
	for (const entry of entries) {
		const what = `${entry.name}@${entry.version}`
		if (!isIdentified(entry)) {
			findings.push({ gate: GATE, what, reason: "bundled file entry without purl, cpe, license, source or hash" })
			continue
		}
		const pattern = locationPattern(entry.location)
		const found = files.filter((candidate) => pattern.test(candidate))
		const [file] = found
		if (file === undefined || found.length > 1) {
			findings.push({ gate: GATE, what, reason: `${found.length} files in the image match ${entry.location}` })
			continue
		}
		if (sha256Of(file) !== entry.sha256) {
			findings.push({ gate: GATE, what: file, reason: `bundled file is not the recorded release file of ${what}` })
			continue
		}
		components.push(fileComponent(entry, file))
	}
	return { components, findings }
}
