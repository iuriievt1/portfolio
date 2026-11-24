import type {
	ArchivedInstance,
	ArchiveExchange,
	ArchiveQueryOutcome,
	ArchiveStoreOutcome,
	DeliverableArtifact,
} from "./archive"

// ADR-003 ř. 21, 28, ADR-005 ř. 37–39, CAP-023-R04
export interface ImageArchivePort {
	// NAB-354, CAP-023-R06, CAP-023-R24
	checkAvailability(signal: AbortSignal | undefined): Promise<ArchiveExchange>

	// NAB-359, CAP-023-R14, CAP-023-R15
	storeImage(artifact: DeliverableArtifact, signal: AbortSignal | undefined): Promise<ArchiveStoreOutcome>

	// CAP-023-R13, CAP-023-R26, integrace-dicom.md 9
	findInstance(instance: ArchivedInstance, signal: AbortSignal | undefined): Promise<ArchiveQueryOutcome>

	// CAP-023-R09, CAP-023-R13, CAP-023-S20
	findStudyPatients(studyInstanceUid: string, signal: AbortSignal | undefined): Promise<ArchiveQueryOutcome>
}
