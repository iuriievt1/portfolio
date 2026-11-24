import { HELD_FOR_REVIEW_CAUSE } from "@ansora/contracts"
import {
	DEFAULT_MAX_PDU_LENGTH,
	DEFAULT_TIMEOUTS,
	DicomDimseAdapter,
	type DimseSettings,
	type StoredArtifact,
} from "@ansora/vulna-adapter-dicom-dimse"
import {
	ARCHIVE_OUTCOME_CLASS,
	type DeliverableArtifact,
	instanceQueryResultOf,
	PERMANENT_FAILURE_CAUSE,
	QUERY_RESULT,
	STORE_DECISION,
	STUDY_QUERY_RESULT,
	type StoreDecision,
	storeJudgementOf,
	studyQueryResultOf,
} from "@ansora/vulna-domain"
import { log } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import {
	FIND_GOLDEN,
	findScenario,
	REJECTION_GOLDEN,
	rejectScenario,
	STORE_GOLDEN,
	storeScenario,
} from "../suite/status-golden"
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID, LOOPBACK_HOST } from "../synthetic"
import { JPEG_BASELINE } from "../uids"
import { hexWord } from "../wire/recorder"
import { artifactOf } from "./adapter-support"
import { closedPort, closePeers, type Peer, startPeer } from "./fork-peer"

// dorucovaci-jadro.md 5, integrace-dicom.md 8.1, ADR-024, quality/README.md povinné testy

const MAX_ATTEMPTS = 5
const FIRST_ATTEMPT = 0
const LAST_ALLOWED_ATTEMPT = MAX_ATTEMPTS - 1
const COUNTED = 1
const UNCOUNTED = 0
const STUDY_INSTANCE_UID = "2.25.401"
const SERIES_INSTANCE_UID = "2.25.402"
const SOP_INSTANCE_UID = "2.25.403"
const PATIENT_ID = "7001011234"
const CANCEL_STATUS = 0xfe_00
const SHORT_TIMEOUTS = { ...DEFAULT_TIMEOUTS, acseMs: 300, dimseMs: 300 }
const TEST_TIMEOUT_MS = 30_000
const CLINICAL_SAFETY_STATUSES = [0xa9_00, 0xc0_00, 0xc0_02, 0xc0_03, 0xc0_04]
const LARGE_PIXEL_BYTES = 8 * 1024 * 1024
const DICOM_PORT = 104
const ZERO_SHA256 = "0".repeat(64)

function settingsOf(port: number, pacsAeTitle: string, timeouts = DEFAULT_TIMEOUTS): DimseSettings {
	return {
		host: LOOPBACK_HOST,
		port,
		pacsAeTitle,
		callingAeTitle: CALLING_AE_TITLE,
		worklistModality: undefined,
		identity: { implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID },
		timeouts,
		maxPduLength: DEFAULT_MAX_PDU_LENGTH,
	}
}

function deliverableOf(artifact: StoredArtifact): DeliverableArtifact {
	return { ...artifact, studyInstanceUid: STUDY_INSTANCE_UID, seriesInstanceUid: SERIES_INSTANCE_UID }
}

// integrace-dicom.md 8.1, dorucovaci-jadro.md 5
function expectedDecisionOf(status: number, ruleId: string): StoreDecision {
	if (CLINICAL_SAFETY_STATUSES.includes(status)) {
		return { kind: STORE_DECISION.HELD_FOR_REVIEW, cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS }
	}
	switch (ruleId) {
		case "STORE.0000":
			return { kind: STORE_DECISION.CONFIRMED, isWithWarning: false }
		case "STORE.Bxxx":
			return { kind: STORE_DECISION.CONFIRMED, isWithWarning: true }
		case "STORE.A700":
		case "STORE.A701":
		case "STORE.A704":
			return { kind: STORE_DECISION.RETRY }
		case "STORE.C001":
			return { kind: STORE_DECISION.VERIFY }
		case "STORE.A703":
			return { kind: STORE_DECISION.TARGET_PAUSED, isVerifiedFirst: true }
		case "STORE.A702":
		case "STORE.A705":
		case "STORE.A706":
		case "STORE.0122":
			return { kind: STORE_DECISION.TARGET_PAUSED, isVerifiedFirst: false }
		default:
			return { kind: STORE_DECISION.PERMANENTLY_FAILED, cause: PERMANENT_FAILURE_CAUSE.UNDOCUMENTED_STATUS }
	}
}

describe("the delivery core judges every C-STORE outcome the adapter reads from the wire", () => {
	let peer: Peer | undefined

	beforeAll(() => {
		log.setLevel("error")
	})

	afterEach(() => {
		closePeers()
		peer = undefined
	})

	async function adapterFor(pacsAeTitle: string, timeouts = DEFAULT_TIMEOUTS): Promise<DicomDimseAdapter> {
		peer ??= await startPeer()
		return new DicomDimseAdapter(settingsOf(peer.port, pacsAeTitle, timeouts))
	}

	it.each(CLINICAL_SAFETY_STATUSES)(
		"B14 never reports the C-STORE status %s as success nor retries it, even on the last attempt",
		async (status) => {
			const adapter = await adapterFor(storeScenario(status))
			const outcome = await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE])), undefined)

			expect(outcome.statusHex).toBe(hexWord(status))
			for (const previousAttempts of [FIRST_ATTEMPT, LAST_ALLOWED_ATTEMPT]) {
				const { decision } = storeJudgementOf(outcome, previousAttempts, MAX_ATTEMPTS)
				expect(decision).toEqual({ kind: STORE_DECISION.HELD_FOR_REVIEW, cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS })
			}
		},
	)

	it.each(STORE_GOLDEN)(
		"dorucovaci-jadro.md 5 decides on the C-STORE status $status",
		async ({ status, classification }) => {
			const adapter = await adapterFor(storeScenario(status))
			const outcome = await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE])), undefined)

			expect(storeJudgementOf(outcome, FIRST_ATTEMPT, MAX_ATTEMPTS).decision).toEqual(
				expectedDecisionOf(status, classification.ruleId),
			)
		},
	)

	it.each(REJECTION_GOLDEN)(
		"CAP-023-R23, CAP-023-R24 pauses on a permanent rejection and waits on a transient one ($result/$source/$reason)",
		async (rejected) => {
			const adapter = await adapterFor(rejectScenario(rejected))
			const judgement = storeJudgementOf(
				await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE])), undefined),
				LAST_ALLOWED_ATTEMPT,
				MAX_ATTEMPTS,
			)

			expect(judgement.countedAttempts).toBe(UNCOUNTED)
			expect(judgement.decision.kind).toBe(
				rejected.classification.pauseTarget ? STORE_DECISION.TARGET_PAUSED : STORE_DECISION.TARGET_UNAVAILABLE,
			)
		},
	)

	it(
		"CAP-023-S03 verifies before any retry when the association ends after the data left",
		async () => {
			const adapter = await adapterFor("ABORT-MID-DATA")
			const outcome = await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE], LARGE_PIXEL_BYTES)), undefined)

			expect(storeJudgementOf(outcome, FIRST_ATTEMPT, MAX_ATTEMPTS)).toMatchObject({
				decision: { kind: STORE_DECISION.VERIFY },
				countedAttempts: COUNTED,
			})
		},
		TEST_TIMEOUT_MS,
	)

	it("CAP-023-S04 pauses the target when the PACS accepts none of the offered transfer syntaxes", async () => {
		const adapter = await adapterFor("AC-UNPROPOSED-TS", SHORT_TIMEOUTS)
		const outcome = await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE])), undefined)

		expect(storeJudgementOf(outcome, FIRST_ATTEMPT, MAX_ATTEMPTS)).toMatchObject({
			decision: { kind: STORE_DECISION.TARGET_PAUSED, isVerifiedFirst: false },
			countedAttempts: UNCOUNTED,
		})
	})

	it("CAP-023-S13 keeps an unreachable PACS out of the attempts", async () => {
		const adapter = new DicomDimseAdapter(settingsOf(await closedPort(), "BASELINE"))
		const outcome = await adapter.storeImage(deliverableOf(artifactOf([JPEG_BASELINE])), undefined)

		expect(storeJudgementOf(outcome, LAST_ALLOWED_ATTEMPT, MAX_ATTEMPTS)).toMatchObject({
			decision: { kind: STORE_DECISION.TARGET_UNAVAILABLE },
			countedAttempts: UNCOUNTED,
		})
		expect((await adapter.checkAvailability(undefined)).classification.outcomeClass).toBe(
			ARCHIVE_OUTCOME_CLASS.TRANSIENT,
		)
	})

	it("CAP-023-S19 holds an artifact whose stored bytes changed and sends no byte", async () => {
		const adapter = await adapterFor("BASELINE")
		const artifact = artifactOf([JPEG_BASELINE])
		const tampered = artifact.variants.map((variant) => ({ ...variant, datasetSha256: ZERO_SHA256 }))
		const outcome = await adapter.storeImage(deliverableOf({ ...artifact, variants: tampered }), undefined)

		expect(storeJudgementOf(outcome, FIRST_ATTEMPT, MAX_ATTEMPTS)).toMatchObject({
			decision: { kind: STORE_DECISION.HELD_FOR_REVIEW, cause: HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH },
			countedAttempts: UNCOUNTED,
		})
		expect(peer?.messagesFromClient() ?? 0).toBe(0)
	})

	it("CAP-023-R06 answers a C-ECHO of a reachable PACS with success", async () => {
		const adapter = await adapterFor("ECHO-0000")

		expect((await adapter.checkAvailability(undefined)).classification.ruleId).toBe("ECHO.0000")
	})

	it.each(FIND_GOLDEN)(
		"CAP-023-S17, CAP-023-S18 never takes the final C-FIND status $status for a missing instance",
		async ({ status }) => {
			const adapter = await adapterFor(findScenario(status))
			const outcome = await adapter.findInstance(
				{
					studyInstanceUid: STUDY_INSTANCE_UID,
					seriesInstanceUid: SERIES_INSTANCE_UID,
					sopInstanceUid: SOP_INSTANCE_UID,
				},
				undefined,
			)

			expect(instanceQueryResultOf(outcome, SOP_INSTANCE_UID)).toBe(
				status === CANCEL_STATUS ? QUERY_RESULT.INTERRUPTED : QUERY_RESULT.REJECTED,
			)
		},
	)

	it("CAP-023-S18 passes a rejected study query on as rejected, never as no conflict", async () => {
		const adapter = await adapterFor(findScenario(0xa7_00))

		expect(studyQueryResultOf(await adapter.findStudyPatients(STUDY_INSTANCE_UID, undefined), PATIENT_ID)).toBe(
			STUDY_QUERY_RESULT.REJECTED,
		)
	})

	it("CAP-023-S16 waits for an unreachable PACS during the verification", async () => {
		const adapter = new DicomDimseAdapter(settingsOf(await closedPort(), "BASELINE"))
		const outcome = await adapter.findInstance(
			{
				studyInstanceUid: STUDY_INSTANCE_UID,
				seriesInstanceUid: SERIES_INSTANCE_UID,
				sopInstanceUid: SOP_INSTANCE_UID,
			},
			undefined,
		)

		expect(instanceQueryResultOf(outcome, SOP_INSTANCE_UID)).toBe(QUERY_RESULT.TARGET_UNAVAILABLE)
	})

	it("ADR-003 ř. 26 refuses a PACS connection that is not a DICOM target before any connection", () => {
		expect(() => new DicomDimseAdapter(settingsOf(DICOM_PORT, "AE TITLE LONGER THAN 16"))).toThrow(RangeError)
	})
})
