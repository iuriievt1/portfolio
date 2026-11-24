import type {
	EncounterContextPort,
	EncounterRecord,
	PatientDirectoryPort,
	PatientIdentifier,
	PatientRecord,
} from "@ansora/vulna-domain/ports"

/**
 * Adapter for the PatientDirectory and EncounterContext ports over the local registry cache
 * ✓ ADR-003 ř. 29.
 *
 * The worker fills the cache from the worklist and from Patient and Study Root Query/Retrieve
 * queries ✓ NAB-077, NAB-167, NAB-298. **An incomplete result never deletes anything**
 * ✓ ADR-005 ř. 39.
 *
 * An adapter knows only its port ✓ ADR-003 ř. 26 — it imports nothing but
 * `@ansora/vulna-domain/ports`.
 */
export class LocalRegistry implements PatientDirectoryPort, EncounterContextPort {
	async findByIdentifier(_identifier: PatientIdentifier): Promise<PatientRecord | undefined> {
		throw new Error("Reading the registry cache is not implemented. The rules are owned by CAP-024.")
	}

	async worklist(_window: { from: string; to: string }): Promise<readonly EncounterRecord[]> {
		throw new Error("The worklist is not implemented. The rules are owned by CAP-024.")
	}
}
