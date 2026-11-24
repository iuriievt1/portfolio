import {
	DIMSE_PHASE,
	type DimseTarget,
	ForkDimseClient,
	INFORMATION_MODEL,
	NOT_SENT_REASON,
} from "@ansora/vulna-adapter-dicom-dimse"
import { log } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { COMMAND_FIELD } from "../dimse"
import {
	ECHO_GOLDEN,
	ECHO_NOT_SENT_GOLDEN,
	echoScenario,
	FIND_CANCELLED_GOLDEN,
	FIND_GOLDEN,
	FIND_INVALID_QUERY_GOLDEN,
	FIND_NO_FINAL_RESPONSE_GOLDEN,
	FIND_SUCCESS_GOLDEN,
	findScenario,
	REJECTION_GOLDEN,
	rejectScenario,
	STORE_ARTIFACT_INTEGRITY_GOLDEN,
	STORE_GOLDEN,
	STORE_NO_CONTEXT_GOLDEN,
	STORE_NOT_SENT_GOLDEN,
	STORE_UNKNOWN_GOLDEN,
	storeScenario,
	WORKLIST_NOT_AUTHORIZED,
} from "../suite/status-golden"
import { CLIENT_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import { JPEG_BASELINE } from "../uids"
import { hexWord } from "../wire/recorder"
import { artifactOf, studyQuery, targetAt, UNREACHED_TARGET, worklistQuery } from "./adapter-support"
import { closedPort, closePeers, type Peer, startPeer } from "./fork-peer"
import { collect } from "./support"

// integrace-dicom.md 8, 8.1, 8.2, 8.3, 11, ADR-003 ř. 27

const LARGE_PIXEL_BYTES = 8 * 1024 * 1024
const SHORT_MS = 300
const SILENT_PEER_TIMEOUTS = { acseMs: SHORT_MS, dimseMs: SHORT_MS }
const TEST_TIMEOUT_MS = 30_000
const MAX_MATCHES = 50
const C_ECHO_RSP = hexWord(COMMAND_FIELD.C_ECHO_RSP)
const C_STORE_RSP = hexWord(COMMAND_FIELD.C_STORE_RSP)
const C_FIND_RSP = hexWord(COMMAND_FIELD.C_FIND_RSP)
const LATIN1_CHARACTER_SET = "ISO_IR 100"
const DIACRITICS = "Ošetření"

const client = new ForkDimseClient({ implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID })

describe("@ansora/vulna-adapter-dicom-dimse classifies every outcome as integrace-dicom.md 8 says, the status read from the wire", () => {
	let peer: Peer | undefined

	beforeAll(() => {
		log.setLevel("error")
	})

	afterEach(() => {
		closePeers()
		peer = undefined
	})

	async function targetOf(calledAeTitle: string, extra: Partial<DimseTarget> = {}): Promise<DimseTarget> {
		peer ??= await startPeer()
		return targetAt(peer.port, calledAeTitle, extra)
	}

	async function wireStatuses(commandField: string): Promise<(string | undefined)[]> {
		peer?.resume()
		const records = await Promise.all(peer?.records ?? [])
		return records
			.flatMap((record) => record.messages)
			.filter((message) => message.direction === "peer-to-client" && message.command?.commandField === commandField)
			.map((message) => message.command?.statusHex)
	}

	it.each(STORE_GOLDEN)("8.1 classifies C-STORE status $status", async ({ status, classification }) => {
		const result = await client.store(await targetOf(storeScenario(status)), artifactOf([JPEG_BASELINE]))

		expect(await wireStatuses(C_STORE_RSP)).toEqual([hexWord(status)])
		expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
		expect(result.statusHex).toBe(hexWord(status))
		expect(result.classification).toEqual(classification)
	})

	it.each(FIND_GOLDEN)("8.2 classifies the final C-FIND status $status", async ({ status, classification }) => {
		const stream = client.find(await targetOf(findScenario(status)), studyQuery())
		const matches = await collect(stream)
		const final = await stream.result

		expect((await wireStatuses(C_FIND_RSP)).at(-1)).toBe(hexWord(status))
		expect(matches).toHaveLength(1)
		expect(final.statusHex).toBe(hexWord(status))
		expect(final.classification).toEqual(classification)
		expect(final.complete).toBe(false)
	})

	it.each(ECHO_GOLDEN)("8.3 classifies C-ECHO status $status", async ({ status, classification }) => {
		const result = await client.echo(await targetOf(echoScenario(status)))

		expect(await wireStatuses(C_ECHO_RSP)).toEqual([hexWord(status)])
		expect(result.statusHex).toBe(hexWord(status))
		expect(result.classification).toEqual(classification)
	})

	it("8.2 takes C001 of the worklist as undocumented, not as a configuration error", async () => {
		const stream = client.find(await targetOf(findScenario(WORKLIST_NOT_AUTHORIZED.status)), worklistQuery())
		await collect(stream)
		const final = await stream.result

		expect((await wireStatuses(C_FIND_RSP)).at(-1)).toBe(hexWord(WORKLIST_NOT_AUTHORIZED.status))
		expect(final.classification).toEqual(WORKLIST_NOT_AUTHORIZED.classification)
	})

	it.each(REJECTION_GOLDEN)(
		"8.3 classifies A-ASSOCIATE-RJ $result/$source/$reason by its result for every operation",
		async (rejection) => {
			const scenario = rejectScenario(rejection)
			const echo = await client.echo(await targetOf(scenario))
			const store = await client.store(await targetOf(scenario), artifactOf([JPEG_BASELINE]))
			const find = await client.find(await targetOf(scenario), studyQuery()).result
			const records = await Promise.all(peer?.records ?? [])
			const expected = { result: rejection.result, source: rejection.source, reason: rejection.reason }

			expect(records.map((record) => record.association.reject)).toEqual([expected, expected, expected])
			for (const result of [echo, store, find]) {
				expect(result.notSentReason).toBe(NOT_SENT_REASON.ASSOCIATION_REJECTED)
				expect(result.association.rejection).toEqual(expected)
				expect(result.classification).toEqual(rejection.classification)
			}
		},
	)

	it("8.1 8.2 classifies success of C-STORE and C-FIND", async () => {
		const store = await client.store(await targetOf("BASELINE"), artifactOf([JPEG_BASELINE]))
		const stream = client.find(await targetOf("BASELINE"), studyQuery())
		await collect(stream)
		const find = await stream.result

		expect(store.classification).toEqual(STORE_GOLDEN[0]?.classification)
		expect(find.classification).toEqual(FIND_SUCCESS_GOLDEN)
		expect(find.complete).toBe(true)
	})

	it(
		"8.3 ADR-005 ř. 33 classifies an abort after data left as an unknown outcome to verify",
		async () => {
			const result = await client.store(
				await targetOf("ABORT-MID-DATA"),
				artifactOf([JPEG_BASELINE], LARGE_PIXEL_BYTES),
			)

			expect(result.phase).toBe(DIMSE_PHASE.UNKNOWN)
			expect(result.classification).toEqual(STORE_UNKNOWN_GOLDEN)
		},
		TEST_TIMEOUT_MS,
	)

	it("8.1 PROTOKOL kap. 3.1 takes a pending status of C-STORE as no result, the outcome is unknown", async () => {
		const result = await client.store(await targetOf("RSP-STORE-FF00"), artifactOf([JPEG_BASELINE]))

		expect(result.phase).toBe(DIMSE_PHASE.UNKNOWN)
		expect(result.statusHex).toBeUndefined()
		expect(result.classification).toEqual(STORE_UNKNOWN_GOLDEN)
	})

	it("8.1 8.3 CAP-023-R16 classifies a C-STORE without an accepted context as a configuration error", async () => {
		const result = await client.store(
			await targetOf("AC-UNPROPOSED-TS", { timeouts: SILENT_PEER_TIMEOUTS }),
			artifactOf([JPEG_BASELINE]),
		)

		expect(result.notSentReason).toBe(NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX)
		expect(result.classification).toEqual(STORE_NO_CONTEXT_GOLDEN)
	})

	it("8.1 CAP-023-R09 classifies a variant that is not the stored one as data, nothing sent", async () => {
		const artifact = artifactOf([JPEG_BASELINE])
		const result = await client.store(UNREACHED_TARGET, { ...artifact, sopClassUid: JPEG_BASELINE })

		expect(result.notSentReason).toBe(NOT_SENT_REASON.ARTIFACT_INTEGRITY)
		expect(result.classification).toEqual(STORE_ARTIFACT_INTEGRITY_GOLDEN)
	})

	it("8.1 8.3 CAP-023-R24 classifies a C-STORE and a C-ECHO without a connection as transient", async () => {
		const port = await closedPort()
		const store = await client.store(targetAt(port, "BASELINE"), artifactOf([JPEG_BASELINE]))
		const echo = await client.echo(targetAt(port, "BASELINE"))

		expect(store.notSentReason).toBe(NOT_SENT_REASON.CONNECT_FAILED)
		expect(store.classification).toEqual(STORE_NOT_SENT_GOLDEN)
		expect(echo.notSentReason).toBe(NOT_SENT_REASON.CONNECT_FAILED)
		expect(echo.classification).toEqual(ECHO_NOT_SENT_GOLDEN)
	})

	it("8.2 classifies a query without a final response as incomplete", async () => {
		const stream = client.find(await targetOf("FIND-NO-FINAL", { timeouts: { dimseMs: SHORT_MS } }), studyQuery())
		await collect(stream)
		const final = await stream.result

		expect(final.phase).toBe(DIMSE_PHASE.UNKNOWN)
		expect(final.classification).toEqual(FIND_NO_FINAL_RESPONSE_GOLDEN)
	})

	it("6.4 8.2 ADR-005 ř. 39 classifies a cancelled query that ended with 0000 as incomplete", async () => {
		const stream = client.find(await targetOf("FIND-CANCEL-OK"), studyQuery({ maxMatches: MAX_MATCHES }))
		await collect(stream)
		const final = await stream.result

		expect(final.statusHex).toBe(hexWord(0))
		expect(final.classification).toEqual(FIND_CANCELLED_GOLDEN)
		expect(final.complete).toBe(false)
	})

	it("8.2 classifies a query whose text its character set cannot carry as data, nothing sent", async () => {
		const query = studyQuery({
			identifier: {
				QueryRetrieveLevel: "STUDY",
				ProcedureCodeSequence: [{ SpecificCharacterSet: LATIN1_CHARACTER_SET, CodeMeaning: DIACRITICS }],
			},
		})
		const final = await client.find(await targetOf("BASELINE"), query).result
		const [record] = await Promise.all(peer?.records ?? [])

		expect(final.phase).toBe(DIMSE_PHASE.NOT_SENT)
		expect(final.notSentReason).toBe(NOT_SENT_REASON.INVALID_QUERY)
		expect(final.classification).toEqual(FIND_INVALID_QUERY_GOLDEN)
		expect(record?.clientToPeer.pduCounts["P-DATA-TF"]).toBeUndefined()
	})

	it("8.2 asks the patient root model as configured", async () => {
		const stream = client.find(await targetOf("BASELINE"), {
			...studyQuery(),
			informationModel: INFORMATION_MODEL.PATIENT_ROOT,
		})
		await collect(stream)

		expect((await stream.result).classification).toEqual(FIND_SUCCESS_GOLDEN)
	})
})
