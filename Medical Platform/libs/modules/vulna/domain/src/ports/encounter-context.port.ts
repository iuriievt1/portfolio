import type { PatientIdentifier } from "./patient-directory.port"

export interface EncounterRecord {
	encounterId: string
	patient: PatientIdentifier
	department: string | undefined
	startedAt: string
}

/**
 * Port `EncounterContext` — encounters and the worklist ✓ ADR-003 ř. 21.
 *
 * In the MOÚ profile the `registry-local` adapter implements it ✓ ADR-003 ř. 29.
 */
export interface EncounterContextPort {
	worklist(window: { from: string; to: string }): Promise<readonly EncounterRecord[]>
}
