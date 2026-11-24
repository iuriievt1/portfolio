import type { Finding } from "../image/finding"
import type { Bom } from "./cyclonedx"

const GATE = "B8"
export const TESSERACT = "tesseract"
export const VERSION_OPTION = "--version"
const BUILT_COMPONENTS = [
	{ name: TESSERACT, version: /^tesseract (\S+)$/m },
	{ name: "leptonica", version: /^\s*leptonica-(\S+)$/m },
]

// ADR-018, vydani-sbom-a-brany.md 2.2
export function checkTesseractVersions(location: string, versionOutput: string, bom: Bom): Finding[] {
	const findings: Finding[] = []
	for (const component of BUILT_COMPONENTS) {
		const version = component.version.exec(versionOutput)?.[1]
		if (version === undefined) {
			findings.push({ gate: GATE, what: location, reason: `${component.name} in the image reports no version` })
			continue
		}
		const isInSbom = bom.components.some((entry) => entry.name === component.name && entry.version === version)
		if (!isInSbom) {
			findings.push({
				gate: GATE,
				what: `${component.name}@${version}`,
				reason: "version in the image missing from the SBOM",
			})
		}
	}
	return findings
}

// ADR-018, ADR-011 ř. 46, vydani-sbom-a-brany.md 2.2
export function checkLanguageModels(
	recorded: ReadonlyMap<string, string>,
	present: ReadonlyMap<string, string>,
	owned: ReadonlySet<string>,
): Finding[] {
	const findings: Finding[] = []
	for (const [path, sha256] of recorded) {
		const actual = present.get(path)
		if (actual === undefined) {
			findings.push({ gate: GATE, what: path, reason: "language model missing from the image" })
			continue
		}
		if (actual !== sha256) {
			findings.push({ gate: GATE, what: path, reason: "language model differs from its recorded SHA-256" })
		}
		if (!owned.has(path)) {
			findings.push({ gate: GATE, what: path, reason: "language model of no package in the SBOM" })
		}
	}
	for (const path of present.keys()) {
		if (!recorded.has(path)) {
			findings.push({ gate: GATE, what: path, reason: "language model without a recorded SHA-256" })
		}
	}
	return findings
}
