import type { EncounterAction } from "@ansora/contracts"
import type { EncounterRefusal, EncounterRow } from "../types/encounter.types"

// CAP-025-R27
export class RejectedEncounterAction extends Error {
	constructor(
		readonly code: EncounterRefusal,
		readonly encounter: EncounterRow,
		readonly action: EncounterAction,
	) {
		super(code)
	}
}
