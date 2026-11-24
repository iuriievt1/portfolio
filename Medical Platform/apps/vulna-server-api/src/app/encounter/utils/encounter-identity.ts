import { nameBasedUuid } from "../../../libs/common/utils/name-based-uuid"
import type { EncounterReference } from "../types/encounter.types"

// ADR-050 bod 10
const ENCOUNTER_ID_NAMESPACE = "6f1c9d2e-3b4a-4c5d-8e7f-0a1b2c3d4e5f"

// RFC 9562 version 5
export function encounterIdOfKey(encounterKey: string): string {
	return nameBasedUuid(ENCOUNTER_ID_NAMESPACE, encounterKey.toLowerCase())
}

// CAP-014-R06
export function namesOneEncounter(reference: EncounterReference): boolean {
	return (reference.encounter_id === undefined) !== (reference.encounter_key === undefined)
}

export function encounterKeyOf(reference: EncounterReference): string {
	if (reference.encounter_key === undefined) {
		throw new Error("the request names neither encounter_id nor encounter_key")
	}
	return reference.encounter_key
}

export function requestedEncounterIdOf(reference: EncounterReference): string {
	return reference.encounter_id ?? encounterIdOfKey(encounterKeyOf(reference))
}
