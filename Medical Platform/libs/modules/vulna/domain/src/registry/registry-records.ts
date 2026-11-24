import type { Identifier, PatientIdentifier, PatientRecord } from "../ports/patient-directory.port"
import type { ScheduledEncounter } from "../ports/registry-source.port"

// datovy-model.md 3
export const REGISTRY_RECORD_SOURCE = {
	WORKLIST: "worklist",
	QUERY: "query",
} as const

export type RegistryRecordSource = (typeof REGISTRY_RECORD_SOURCE)[keyof typeof REGISTRY_RECORD_SOURCE]

// datovy-model.md 7
export const PATIENT_ORIGIN = {
	REGISTRY: "registry",
	DOCUMENTED_BY_VULNA: "documented_by_vulna",
	// CHG-175, CAP-013-R10
	CREATED_IN_APP: "created_in_app",
} as const

export const IDENTIFIER_SOURCE = {
	...REGISTRY_RECORD_SOURCE,
	CREATED_IN_APP: "created_in_app",
} as const

export const ENCOUNTER_SOURCE = {
	WORKLIST: REGISTRY_RECORD_SOURCE.WORKLIST,
	CREATED_IN_APP: "created_in_app",
} as const

export type EncounterSource = (typeof ENCOUNTER_SOURCE)[keyof typeof ENCOUNTER_SOURCE]

export interface SourcedPatientRecord {
	record: PatientRecord
	source: RegistryRecordSource
}

export interface PatientGroup {
	key: string
	identifiers: PatientIdentifier[]
	record: PatientRecord
	source: RegistryRecordSource
}

const NO_ISSUER = null

// CAP-024-R07
export function identifierKeyOf(identifier: Identifier): string {
	return JSON.stringify([identifier.system, identifier.value, identifier.issuer ?? NO_ISSUER])
}

class IdentifierGroups {
	private readonly parents = new Map<string, string>()

	rootOf(key: string): string {
		let root = key
		for (let parent = this.parents.get(root); parent !== undefined && parent !== root; ) {
			root = parent
			parent = this.parents.get(root)
		}
		this.parents.set(key, root)
		return root
	}

	join(keys: readonly string[]): void {
		const [first, ...rest] = keys.map((key) => this.rootOf(key))
		if (first === undefined) {
			return
		}
		for (const root of rest) {
			this.parents.set(root, first)
		}
	}
}

export function uniqueIdentifiers(identifiers: readonly Identifier[]): Identifier[] {
	const byKey = new Map(identifiers.map((identifier) => [identifierKeyOf(identifier), identifier]))
	return [...byKey.values()]
}

export function sameIdentifiers(first: readonly Identifier[], second: readonly Identifier[]): boolean {
	const firstKeys = new Set(first.map(identifierKeyOf))
	const secondKeys = new Set(second.map(identifierKeyOf))
	return firstKeys.size === secondKeys.size && [...firstKeys].every((key) => secondKeys.has(key))
}

// CAP-024-R07, CAP-024-S05, integrace-dicom.md 5.1
export function patientGroupsOf(records: readonly SourcedPatientRecord[]): PatientGroup[] {
	const groups = new IdentifierGroups()
	for (const { record } of records) {
		groups.join(record.identifiers.map(identifierKeyOf))
	}
	const byRoot = new Map<string, PatientGroup>()
	for (const { record, source } of records) {
		const first = record.identifiers[0]
		if (first === undefined) {
			continue
		}
		const root = groups.rootOf(identifierKeyOf(first))
		const existing = byRoot.get(root)
		if (existing === undefined) {
			byRoot.set(root, { key: root, identifiers: uniqueIdentifiers(record.identifiers), record, source })
			continue
		}
		existing.identifiers = uniqueIdentifiers([...existing.identifiers, ...record.identifiers])
		if (existing.source !== REGISTRY_RECORD_SOURCE.WORKLIST && source === REGISTRY_RECORD_SOURCE.WORKLIST) {
			existing.record = record
			existing.source = source
		}
	}
	return [...byRoot.values()]
}

export function groupKeysByIdentifier(groups: readonly PatientGroup[]): Map<string, string> {
	return new Map(
		groups.flatMap((group) => group.identifiers.map((identifier) => [identifierKeyOf(identifier), group.key] as const)),
	)
}

const UNTIMED_LAST = "~"

function scheduleKeyOf(encounter: ScheduledEncounter): string {
	return `${encounter.scheduledDate} ${encounter.scheduledTime ?? UNTIMED_LAST}`
}

// CAP-014-R03, integrace-dicom.md 4
export function uniqueEncountersOf(encounters: readonly ScheduledEncounter[]): ScheduledEncounter[] {
	const byStudy = new Map<string, ScheduledEncounter>()
	for (const encounter of encounters) {
		const existing = byStudy.get(encounter.studyInstanceUid)
		if (existing === undefined || scheduleKeyOf(encounter) < scheduleKeyOf(existing)) {
			byStudy.set(encounter.studyInstanceUid, encounter)
		}
	}
	return [...byStudy.values()]
}
