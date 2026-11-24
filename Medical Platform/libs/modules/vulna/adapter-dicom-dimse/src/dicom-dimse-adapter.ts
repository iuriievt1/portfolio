import type {
	ArchivedInstance,
	ArchiveExchange,
	ArchiveQueryOutcome,
	ArchiveStoreOutcome,
	DayInterval,
	DeliverableArtifact,
	DocumentArchivePort,
	ImageArchivePort,
	PatientIdentifier,
	PatientRecord,
	RegistryQueryResult,
	RegistrySourcePort,
	ScheduledEncounter,
} from "@ansora/vulna-domain/ports"
import { checkTarget, type ImplementationIdentity } from "./association-session"
import {
	type DicomIdentifier,
	type DimseClient,
	type DimseTarget,
	type DimseTimeouts,
	type FindFinal,
	INFORMATION_MODEL,
	type StoredArtifact,
	type StoreResult,
} from "./contract"
import { ForkDimseClient } from "./fork-dimse-client"

export interface DimseSettings {
	host: string
	port: number
	pacsAeTitle: string
	// NAB-352, TS-145
	callingAeTitle: string
	// CAP-024-R14
	worklistModality: string | undefined
	// CAP-012-R17, integrace-dicom.md 5.0
	identity: ImplementationIdentity
	// integrace-dicom.md 6.3, konfigurace-a-profily.md 2.7
	timeouts: DimseTimeouts
	// TS-059, integrace-dicom.md 6.3, 10
	maxPduLength: number
}

// PS3.4 C.6.2.1, integrace-dicom.md 9
const QUERY_LEVEL = {
	STUDY: "STUDY",
	IMAGE: "IMAGE",
} as const

// PS3.4 C.4.1.1.3.1
const UNIVERSAL_MATCH = ""

// PS3.6 (0008,0018), (0010,0020)
const SOP_INSTANCE_UID = "SOPInstanceUID"
const PATIENT_ID = "PatientID"

// integrace-dicom.md 6.4
const MISSING_VALUE = ""

type Exchange = Pick<
	StoreResult,
	"phase" | "notSentReason" | "statusHex" | "errorComment" | "association" | "classification"
>

// integrace-dicom.md 6.2
function exchangeOf(result: Exchange): ArchiveExchange {
	return {
		phase: result.phase,
		notSentReason: result.notSentReason,
		timeout: result.association.timeout,
		statusHex: result.statusHex,
		errorComment: result.errorComment,
		classification: result.classification,
	}
}

// integrace-dicom.md 6.1, CAP-023-R15
function storedArtifactOf(artifact: DeliverableArtifact): StoredArtifact {
	return {
		sopClassUid: artifact.sopClassUid,
		sopInstanceUid: artifact.sopInstanceUid,
		studyInstanceUid: artifact.studyInstanceUid,
		seriesInstanceUid: artifact.seriesInstanceUid,
		variants: artifact.variants.map((variant) => ({
			transferSyntaxUid: variant.transferSyntaxUid,
			part10: Buffer.from(variant.part10.buffer, variant.part10.byteOffset, variant.part10.byteLength),
			datasetSha256: variant.datasetSha256,
		})),
	}
}

// integrace-dicom.md 6.4, PS3.4 C.4.1.1.3
function singleTextValueOf(value: unknown): string {
	if (typeof value === "string") {
		return value
	}
	if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
		return value[0]
	}
	return MISSING_VALUE
}

// CAP-023-R13, CAP-023-R26
function queryOutcomeOf(final: FindFinal, matchedValues: readonly string[]): ArchiveQueryOutcome {
	return {
		...exchangeOf(final),
		isComplete: final.complete,
		matchedValues,
	}
}

// ADR-003 ř. 27–29, 42, ADR-005 ř. 38–40, integrace-dicom.md
export class DicomDimseAdapter implements ImageArchivePort, DocumentArchivePort, RegistrySourcePort {
	private readonly target: DimseTarget

	constructor(
		settings: DimseSettings,
		private readonly client: DimseClient = new ForkDimseClient(settings.identity),
	) {
		this.target = {
			host: settings.host,
			port: settings.port,
			callingAeTitle: settings.callingAeTitle,
			calledAeTitle: settings.pacsAeTitle,
			maxPduLength: settings.maxPduLength,
			timeouts: settings.timeouts,
		}
		checkTarget(this.target)
	}

	// NAB-354, CAP-023-R03, CAP-023-R06
	async checkAvailability(signal: AbortSignal | undefined): Promise<ArchiveExchange> {
		return exchangeOf(await this.client.echo(this.target, signal))
	}

	// NAB-359, CAP-023-R14, CAP-023-R15
	async storeImage(artifact: DeliverableArtifact, signal: AbortSignal | undefined): Promise<ArchiveStoreOutcome> {
		return await this.store(artifact, signal)
	}

	// NAB-359, ADR-018, CAP-023-R15
	async storeDocument(artifact: DeliverableArtifact, signal: AbortSignal | undefined): Promise<ArchiveStoreOutcome> {
		return await this.store(artifact, signal)
	}

	// CAP-023-R13, integrace-dicom.md 9
	async findInstance(instance: ArchivedInstance, signal: AbortSignal | undefined): Promise<ArchiveQueryOutcome> {
		return await this.find(
			{
				QueryRetrieveLevel: QUERY_LEVEL.IMAGE,
				StudyInstanceUID: instance.studyInstanceUid,
				SeriesInstanceUID: instance.seriesInstanceUid,
				SOPInstanceUID: instance.sopInstanceUid,
			},
			SOP_INSTANCE_UID,
			signal,
		)
	}

	// CAP-023-R09, CAP-023-R13, CAP-023-S20
	async findStudyPatients(studyInstanceUid: string, signal: AbortSignal | undefined): Promise<ArchiveQueryOutcome> {
		return await this.find(
			{ QueryRetrieveLevel: QUERY_LEVEL.STUDY, StudyInstanceUID: studyInstanceUid, PatientID: UNIVERSAL_MATCH },
			PATIENT_ID,
			signal,
		)
	}

	async scheduledEncounters(_interval: DayInterval): Promise<RegistryQueryResult<ScheduledEncounter>> {
		throw new Error("Modality Worklist C-FIND is not implemented. Owned by ADR-017 and ADR-035 bod 2.")
	}

	async studyPatients(_interval: DayInterval): Promise<RegistryQueryResult<PatientRecord>> {
		throw new Error("Study Root C-FIND is not implemented. Owned by ADR-017 and ADR-035 bod 2.")
	}

	async patient(_identifier: PatientIdentifier): Promise<RegistryQueryResult<PatientRecord>> {
		throw new Error("Patient Root C-FIND is not implemented. Owned by ADR-017 and ADR-035 bod 2.")
	}

	private async store(artifact: DeliverableArtifact, signal: AbortSignal | undefined): Promise<ArchiveStoreOutcome> {
		const result = await this.client.store(this.target, storedArtifactOf(artifact), signal)
		return { ...exchangeOf(result), acceptedTransferSyntax: result.acceptedTransferSyntax }
	}

	// integrace-dicom.md 6.4, 9
	private async find(
		identifier: DicomIdentifier,
		returnedKeyword: string,
		signal: AbortSignal | undefined,
	): Promise<ArchiveQueryOutcome> {
		const stream = this.client.find(this.target, { informationModel: INFORMATION_MODEL.STUDY_ROOT, identifier }, signal)
		const matchedValues: string[] = []
		for await (const match of stream) {
			matchedValues.push(singleTextValueOf(match.identifier[returnedKeyword]))
		}
		return queryOutcomeOf(await stream.result, matchedValues)
	}
}
