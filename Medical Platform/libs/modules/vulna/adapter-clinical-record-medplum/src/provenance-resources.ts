import type { BundleEntry, Provenance } from "./fhir-types"
import { type IdentifierSystems, tokenOf } from "./identifiers"

const PROVENANCE_ACTIVITY_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-DataOperation"
const PROVENANCE_ACTIVITY_UPDATE = "UPDATE"
const PROVENANCE_AGENT_SYSTEM = "http://terminology.hl7.org/CodeSystem/provenance-participant-type"

// ADR-050
export const PROVENANCE_ROLE = {
	AUTHOR: "author",
	COMPOSER: "composer",
} as const

export type ProvenanceRole = (typeof PROVENANCE_ROLE)[keyof typeof PROVENANCE_ROLE]

type ProvenanceAgentActor = NonNullable<Provenance["agent"]>[number]["who"]

export interface ProvenanceAgent {
	role: ProvenanceRole
	who: ProvenanceAgentActor
}

export interface ProvenanceStatement {
	key: string
	patientId: string
	targets: readonly string[]
	recorded: string
	// integrace-dicom.md 5.9 Instance Creation Date/Time
	occurred: string | undefined
	agents: readonly ProvenanceAgent[]
}

// ADR-050, datovy-model.md 13.1 vulna-provenance
export function acquisitionProvenanceKeyOf(acquisitionId: string, event: string): string {
	return `acquisition:${acquisitionId}:${event}`
}

// ADR-050, datovy-model.md 13.1, datovy-model.md 13.3
function provenanceOf(statement: ProvenanceStatement, systems: IdentifierSystems): Provenance {
	const provenance: Provenance = {
		resourceType: "Provenance",
		meta: {
			tag: [
				{ system: systems.provenanceKeyTag, code: statement.key },
				{ system: systems.patientTag, code: statement.patientId },
			],
		},
		target: statement.targets.map((reference) => ({ reference })),
		recorded: statement.recorded,
		activity: { coding: [{ system: PROVENANCE_ACTIVITY_SYSTEM, code: PROVENANCE_ACTIVITY_UPDATE }] },
		agent: statement.agents.map((agent) => ({
			type: { coding: [{ system: PROVENANCE_AGENT_SYSTEM, code: agent.role }] },
			who: agent.who,
		})),
	}
	if (statement.occurred !== undefined) {
		provenance.occurredDateTime = statement.occurred
	}
	return provenance
}

// ADR-050
export function provenanceEntryOf(statement: ProvenanceStatement, systems: IdentifierSystems): BundleEntry {
	const tag = tokenOf(systems.provenanceKeyTag, statement.key)
	return {
		resource: provenanceOf(statement, systems),
		request: { method: "POST", url: "Provenance", ifNoneExist: `_tag=${encodeURIComponent(tag)}` },
	}
}
