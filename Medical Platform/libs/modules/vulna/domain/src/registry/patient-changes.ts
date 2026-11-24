import type { PatientIdentifier, PatientRecord } from "../ports/patient-directory.port"
import { identifierKeyOf } from "./registry-records"

export interface CachedIdentifier {
	identifier: PatientIdentifier
	isCurrent: boolean
	isFromRegistry: boolean
}

export interface IdentifierChanges {
	added: PatientIdentifier[]
	restored: PatientIdentifier[]
	retired: PatientIdentifier[]
}

// datovy-model.md 7, ADR-050 bod 9
export function demographicsDiffer(cached: PatientRecord, incoming: PatientRecord): boolean {
	return (
		cached.familyName !== incoming.familyName ||
		cached.givenName !== incoming.givenName ||
		cached.birthDate !== incoming.birthDate ||
		cached.sex !== incoming.sex
	)
}

// CAP-024-R07, datovy-model.md 7
export function identifierChangesOf(
	cached: readonly CachedIdentifier[],
	incoming: readonly PatientIdentifier[],
): IdentifierChanges {
	const cachedByKey = new Map(cached.map((entry) => [identifierKeyOf(entry.identifier), entry]))
	const incomingKeys = new Set(incoming.map(identifierKeyOf))
	return {
		added: incoming.filter((identifier) => !cachedByKey.has(identifierKeyOf(identifier))),
		restored: incoming.filter((identifier) => cachedByKey.get(identifierKeyOf(identifier))?.isCurrent === false),
		retired: cached
			.filter(
				(entry) => entry.isCurrent && entry.isFromRegistry && !incomingKeys.has(identifierKeyOf(entry.identifier)),
			)
			.map((entry) => entry.identifier),
	}
}

export function hasIdentifierChanges(changes: IdentifierChanges): boolean {
	return changes.added.length > 0 || changes.restored.length > 0 || changes.retired.length > 0
}
