import type { Finding } from "../image/finding"
import { type Component, LOCATION_PROPERTY, MANUFACTURER } from "./cyclonedx"

const GATE = "B8"

// ADR-005, backend.md 5
export const OWN_EXECUTABLES = [{ name: "ocr-sandbox", location: "/usr/local/bin/ocr-sandbox" }] as const

// ADR-005, ADR-011 ř. 49
export function ownExecutableComponents(version: string, licenseName: string): Component[] {
	return OWN_EXECUTABLES.map(({ name, location }) => {
		const purl = `pkg:generic/${MANUFACTURER}/${name}@${version}`
		return {
			"bom-ref": purl,
			type: "application",
			name,
			version,
			purl,
			supplier: { name: MANUFACTURER },
			licenses: [{ license: { name: licenseName } }],
			properties: [{ name: LOCATION_PROPERTY, value: location }],
		}
	})
}

// ADR-005, vydani-sbom-a-brany.md 2.2
export function checkOwnExecutables(files: ReadonlySet<string>): Finding[] {
	return OWN_EXECUTABLES.filter(({ location }) => !files.has(location)).map(({ location }) => ({
		gate: GATE,
		what: location,
		reason: "own executable missing from the image",
	}))
}
