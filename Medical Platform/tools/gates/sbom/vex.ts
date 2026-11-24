import type { Finding } from "../image/finding"
import { type Bom, componentKeys, purlKey } from "./cyclonedx"

const GATE = "B6"

export interface VexDocument {
	vulnerabilities?: { id?: string; affects?: { ref: string }[] }[]
}

export function vexStatements(vex: VexDocument): { id: string; ref: string }[] {
	return (vex.vulnerabilities ?? []).flatMap((vulnerability) =>
		(vulnerability.affects ?? []).map((affected) => ({ id: vulnerability.id ?? "unknown", ref: affected.ref })),
	)
}

export function checkVex(vex: VexDocument, image: Bom): Finding[] {
	const keys = componentKeys(image)
	const refs = new Set(image.components.map((component) => component["bom-ref"]))
	const findings: Finding[] = []
	for (const { id, ref } of vexStatements(vex)) {
		if (refs.has(ref) || keys.has(purlKey(ref))) {
			findings.push({
				gate: GATE,
				what: `${id} ${purlKey(ref)}`,
				reason: "VEX statement about a component present in the image; the notification duty remains",
			})
		}
	}
	return findings
}
