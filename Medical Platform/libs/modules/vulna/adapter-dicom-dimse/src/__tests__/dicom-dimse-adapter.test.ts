import { describe, expect, it } from "vitest"
import {
	ASSOCIATION_OUTCOME,
	type DimseClient,
	type FindFinal,
	type FindMatch,
	type FindQuery,
	INFORMATION_MODEL,
	type StoredArtifact,
	type StoreResult,
} from "../contract"
import { DicomDimseAdapter, type DimseSettings } from "../dicom-dimse-adapter"

const SETTINGS: DimseSettings = {
	host: "pacs.hospital.example",
	port: 104,
	pacsAeTitle: "AMIS",
	callingAeTitle: "ANSORA_VULNA",
	worklistModality: undefined,
	identity: { implementationClassUid: "2.25.11" },
	timeouts: { connectMs: 10_000, acseMs: 30_000, dimseMs: 120_000, idleMs: 300_000 },
	maxPduLength: 16_384,
}
const STUDY = "2.25.21"
const SERIES = "2.25.22"
const INSTANCE = "2.25.23"
const PATIENT_ID = "7001011234"
const ACCEPTED = "1.2.840.10008.1.2.4.50"
const NO_TIMINGS = { connectedMs: undefined, associatedMs: undefined, respondedMs: undefined, closedMs: 0 }
const REPORT = {
	outcome: ASSOCIATION_OUTCOME.RELEASED,
	timeout: undefined,
	rejection: undefined,
	abort: undefined,
	peerMaxPduLength: undefined,
	peerImplementationClassUid: undefined,
	peerImplementationVersionName: undefined,
}
const SUCCESS = {
	outcomeClass: "success",
	retryPolicy: "never",
	retentionAnchor: false,
	clinicalSafetyQueue: false,
	alertAdmin: false,
	pauseTarget: false,
	ruleId: "FIND.0000",
} as const

function matchOf(identifier: Record<string, unknown>): FindMatch {
	return {
		statusHex: "FF00",
		identifier,
		specificCharacterSet: undefined,
		characterSetMissing: false,
		afterCancel: false,
	}
}

function finalOf(matches: number): FindFinal {
	return {
		phase: "response",
		notSentReason: undefined,
		statusHex: "0000",
		errorComment: undefined,
		complete: true,
		matches,
		matchesAfterCancel: 0,
		droppedAfterCancel: 0,
		maxQueued: matches,
		cancelRequested: false,
		cancelReason: undefined,
		association: REPORT,
		classification: SUCCESS,
		timingsMs: NO_TIMINGS,
	}
}

const REJECTED_REPORT = {
	...REPORT,
	outcome: ASSOCIATION_OUTCOME.REJECTED,
	rejection: { result: 2, source: 3, reason: 1 },
}

function fakeClient(matches: readonly FindMatch[]) {
	const queries: FindQuery[] = []
	const stored: StoredArtifact[] = []
	const signals: (AbortSignal | undefined)[] = []
	const client: DimseClient = {
		echo: async (_target, signal) => {
			signals.push(signal)
			return {
				phase: "not-sent",
				notSentReason: "association-rejected",
				statusHex: undefined,
				errorComment: undefined,
				association: REJECTED_REPORT,
				classification: { ...SUCCESS, outcomeClass: "transient", retryPolicy: "backoff", ruleId: "RJ.2/3/1" },
				timingsMs: NO_TIMINGS,
			}
		},
		probe: async () => {
			throw new Error("not used")
		},
		store: async (_target, artifact, signal) => {
			stored.push(artifact)
			signals.push(signal)
			return {
				phase: "response",
				notSentReason: undefined,
				datasetBytesFlushed: 1,
				datasetSent: true,
				sentDatasetSha256: undefined,
				acceptedTransferSyntax: ACCEPTED,
				presentationContextId: 1,
				statusHex: "0000",
				errorComment: undefined,
				association: { ...REPORT, timeout: "dimse" },
				classification: { ...SUCCESS, retentionAnchor: true, ruleId: "STORE.0000" },
				timingsMs: NO_TIMINGS,
			} satisfies StoreResult
		},
		find: (_target, query, signal) => {
			queries.push(query)
			signals.push(signal)
			return {
				cancel: () => undefined,
				result: Promise.resolve(finalOf(matches.length)),
				async *[Symbol.asyncIterator]() {
					yield* matches
				},
			}
		},
	}
	return { client, queries, stored, signals }
}

const ARTIFACT = {
	sopClassUid: "1.2.840.10008.5.1.4.1.1.104.1",
	sopInstanceUid: INSTANCE,
	studyInstanceUid: STUDY,
	seriesInstanceUid: SERIES,
	variants: [{ transferSyntaxUid: ACCEPTED, part10: new Uint8Array([2, 3]), datasetSha256: "a".repeat(64) }],
}

describe("DICOM DIMSE adapter over the DimseClient ✓ integrace-dicom.md 6, 9", () => {
	it("CAP-023-R13 asks for the instance at the IMAGE level with the study and series as unique keys", async () => {
		const { client, queries } = fakeClient([matchOf({ SOPInstanceUID: INSTANCE })])
		const adapter = new DicomDimseAdapter(SETTINGS, client)

		const outcome = await adapter.findInstance(
			{ studyInstanceUid: STUDY, seriesInstanceUid: SERIES, sopInstanceUid: INSTANCE },
			undefined,
		)

		expect(queries).toEqual([
			{
				informationModel: INFORMATION_MODEL.STUDY_ROOT,
				identifier: {
					QueryRetrieveLevel: "IMAGE",
					StudyInstanceUID: STUDY,
					SeriesInstanceUID: SERIES,
					SOPInstanceUID: INSTANCE,
				},
			},
		])
		expect(outcome).toMatchObject({ statusHex: "0000", isComplete: true, matchedValues: [INSTANCE] })
	})

	it("CAP-023-R13 asks which patient a study belongs to at the STUDY level, one value per match", async () => {
		const { client, queries } = fakeClient([
			matchOf({ PatientID: PATIENT_ID }),
			matchOf({}),
			matchOf({ PatientID: [] }),
		])
		const adapter = new DicomDimseAdapter(SETTINGS, client)

		const outcome = await adapter.findStudyPatients(STUDY, undefined)

		expect(queries[0]?.identifier).toEqual({ QueryRetrieveLevel: "STUDY", StudyInstanceUID: STUDY, PatientID: "" })
		expect(outcome.matchedValues).toEqual([PATIENT_ID, "", ""])
	})

	it("CAP-023-R15 hands over the stored bytes of every variant and reports the accepted transfer syntax", async () => {
		const { client, stored } = fakeClient([])
		const adapter = new DicomDimseAdapter(SETTINGS, client)
		const part10 = new Uint8Array([1, 2, 3, 4]).subarray(1, 3)

		const outcome = await adapter.storeImage(
			{
				sopClassUid: "1.2.840.10008.5.1.4.1.1.77.1.4",
				sopInstanceUid: INSTANCE,
				studyInstanceUid: STUDY,
				seriesInstanceUid: SERIES,
				variants: [{ transferSyntaxUid: ACCEPTED, part10, datasetSha256: "a".repeat(64) }],
			},
			undefined,
		)

		expect(stored[0]?.variants[0]?.part10).toEqual(Buffer.from([2, 3]))
		expect(outcome).toMatchObject({ acceptedTransferSyntax: ACCEPTED, statusHex: "0000", timeout: "dimse" })
	})

	it("CAP-023-R25 hands the lease signal to every association it opens", async () => {
		const { client, signals } = fakeClient([])
		const adapter = new DicomDimseAdapter(SETTINGS, client)
		const lease = new AbortController()

		await adapter.storeDocument(ARTIFACT, lease.signal)
		await adapter.findInstance(
			{ studyInstanceUid: STUDY, seriesInstanceUid: SERIES, sopInstanceUid: INSTANCE },
			lease.signal,
		)
		await adapter.findStudyPatients(STUDY, lease.signal)
		await adapter.checkAvailability(lease.signal)

		expect(signals).toEqual([lease.signal, lease.signal, lease.signal, lease.signal])
	})

	it("CAP-023-R24 reports a C-ECHO the PACS rejected for now with its phase, reason and rule", async () => {
		const { client } = fakeClient([])
		const adapter = new DicomDimseAdapter(SETTINGS, client)

		expect(await adapter.checkAvailability(undefined)).toEqual({
			phase: "not-sent",
			notSentReason: "association-rejected",
			timeout: undefined,
			statusHex: undefined,
			errorComment: undefined,
			classification: expect.objectContaining({ outcomeClass: "transient", ruleId: "RJ.2/3/1" }),
		})
	})
})
