import type { ArchiveStoreOutcome, DeliverableArtifact } from "./archive"

// ADR-003 ř. 21, 28, ADR-018, CAP-023-R04
export interface DocumentArchivePort {
	// NAB-359, CAP-023-R14, CAP-023-R15
	storeDocument(artifact: DeliverableArtifact, signal: AbortSignal | undefined): Promise<ArchiveStoreOutcome>
}
