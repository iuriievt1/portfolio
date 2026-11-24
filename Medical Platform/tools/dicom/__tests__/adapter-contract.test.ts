import { type AddressInfo, createServer, type Server } from "node:net"
import {
	ASSOCIATION_OUTCOME,
	CANCEL_REASON,
	DIMSE_PHASE,
	type DimseTarget,
	type FindMatch,
	ForkDimseClient,
	NOT_SENT_REASON,
	type StoredArtifact,
	type StoredVariant,
	TIMEOUT_KIND,
} from "@ansora/vulna-adapter-dicom-dimse"
import { Client, Dataset, log } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { STATUS } from "../dimse"
import {
	ASCII_PATIENT_NAME,
	LATIN1_PATIENT_NAME,
	NESTED_UTF8_PATIENT_NAME,
	PACKED_PENDING,
	PENDING_BEFORE_CANCEL,
} from "../hostile/cases"
import { PROFILE_MAX_PDU_LENGTH } from "../pdu"
import {
	FIND_CANCELLED_GOLDEN,
	STORE_ARTIFACT_INTEGRITY_GOLDEN,
	STORE_NO_CONTEXT_GOLDEN,
	STORE_NOT_SENT_GOLDEN,
} from "../suite/status-golden"
import { CLIENT_IMPLEMENTATION_CLASS_UID, LOOPBACK_HOST } from "../synthetic"
import {
	EXPLICIT_VR_LITTLE_ENDIAN,
	IMPLICIT_VR_LITTLE_ENDIAN,
	JPEG_BASELINE,
	SECONDARY_CAPTURE_IMAGE_STORAGE,
	VERIFICATION,
} from "../uids"
import { hexWord } from "../wire/recorder"
import { artifactOf, storedBytesOf, studyQuery, targetAt, UNREACHED_TARGET } from "./adapter-support"
import { closedPort, closePeers, type Peer, startPeer } from "./fork-peer"
import { collect, sha256, until, wait } from "./support"

// integrace-dicom.md 6, 8.1, 8.2, 8.3, 9.1, ADR-003 ř. 29, ADR-005 ř. 22, 23, 33, ADR-017

const IMPLEMENTATION_VERSION_NAME = "VULNA_TEST"
const LARGE_PIXEL_BYTES = 8 * 1024 * 1024
const SHORT_MS = 300
const SILENT_PEER_TIMEOUTS = { acseMs: SHORT_MS, dimseMs: SHORT_MS }
const STALL_MS = 200
const MAX_MATCHES = 50
const CALLER_CANCEL_AFTER = 10
const RETURN_AFTER = 5
const SMALL_HIGH_WATER_MARK = 16
// integrace-dicom.md 6.3
const SPEC_HIGH_WATER_MARK = 64
const FLOOD_MATCHES = 200
const SLOW_CONSUMER_MS = 2
const TAKEN_BEFORE_RESUME = SMALL_HIGH_WATER_MARK - SMALL_HIGH_WATER_MARK / 4
const LONG_STALL_MS = 10_000
const TOO_MANY_CONTEXTS = 129
const TEST_TIMEOUT_MS = 30_000
const SHA256_HEX_LENGTH = 64
const WRONG_SHA256 = "0".repeat(SHA256_HEX_LENGTH)
const C_STORE_RQ = hexWord(0x00_01)
const SUCCESS_HEX = hexWord(STATUS.SUCCESS)
const CANCEL_HEX = hexWord(STATUS.CANCEL)
const PENDING_HEX = hexWord(STATUS.PENDING)
const PENDING_WARNING_HEX = hexWord(STATUS.PENDING_WARNING)

const client = new ForkDimseClient({
	implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: IMPLEMENTATION_VERSION_NAME,
})

async function listening(server: Server): Promise<number> {
	return new Promise((resolve) =>
		server.listen(0, LOOPBACK_HOST, () => resolve((server.address() as AddressInfo).port)),
	)
}

describe("@ansora/vulna-adapter-dicom-dimse keeps the DimseClient contract, read from the wire by our own decoder", () => {
	let peer: Peer | undefined
	let counting: Server | undefined

	beforeAll(() => {
		log.setLevel("error")
	})

	afterEach(() => {
		closePeers()
		peer = undefined
		counting?.close()
		counting = undefined
	})

	async function targetOf(calledAeTitle: string, extra: Partial<DimseTarget> = {}): Promise<DimseTarget> {
		peer = await startPeer()
		return targetAt(peer.port, calledAeTitle, extra)
	}

	async function recorded() {
		peer?.resume()
		const record = await peer?.record
		if (record === undefined) {
			throw new Error("no connection was recorded")
		}
		return record
	}

	async function countingTarget(): Promise<{ target: DimseTarget; connections: () => number }> {
		let connections = 0
		counting = createServer((socket) => {
			connections += 1
			socket.destroy()
		})
		const port = await listening(counting)
		return { target: targetAt(port, "BASELINE"), connections: () => connections }
	}

	describe("echo", () => {
		it("NAB-354 integrace-dicom.md 6.1 verifies the connection and identifies the implementation", async () => {
			const result = await client.echo(await targetOf("BASELINE"))
			const record = await recorded()

			expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
			expect(result.notSentReason).toBeUndefined()
			expect(result.statusHex).toBe(SUCCESS_HEX)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.RELEASED)
			expect(result.association.peerImplementationClassUid).toBeDefined()
			const { connectedMs, associatedMs, respondedMs, closedMs } = result.timingsMs
			expect(connectedMs).toBeLessThanOrEqual(associatedMs ?? Number.NaN)
			expect(associatedMs).toBeLessThanOrEqual(respondedMs ?? Number.NaN)
			expect(respondedMs).toBeLessThanOrEqual(closedMs)
			expect(record.association.request?.implementationClassUid).toBe(CLIENT_IMPLEMENTATION_CLASS_UID)
			expect(record.association.request?.implementationVersionName).toBe(IMPLEMENTATION_VERSION_NAME)
			expect(record.association.request?.maxPduLength).toBe(PROFILE_MAX_PDU_LENGTH)
			expect(record.association.request?.presentationContexts).toEqual([
				{ id: 1, abstractSyntax: VERIFICATION, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
			])
		})

		it("integrace-dicom.md 6.2, 8.3 sends nothing to a peer that rejects the association", async () => {
			const result = await client.echo(await targetOf("NO-SUCH-AE"))

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ASSOCIATION_REJECTED)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.REJECTED)
			expect(result.association.rejection).toEqual({
				result: expect.any(Number),
				source: expect.any(Number),
				reason: expect.any(Number),
			})
		})

		it("integrace-dicom.md 6.2 cannot connect to a port nothing listens on", async () => {
			const result = await client.echo(targetAt(await closedPort(), "BASELINE"))

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.CONNECT_FAILED)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.NOT_CONNECTED)
		})

		it("integrace-dicom.md 6.2 does not connect with a signal aborted before", async () => {
			const { target, connections } = await countingTarget()
			const result = await client.echo(target, AbortSignal.abort())

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
			expect(connections()).toBe(0)
		})

		it("integrace-dicom.md 6.3, 8.3 ends without data when the association is not answered in the ACSE timeout", async () => {
			const result = await client.echo(await targetOf("NO-RESPONSE", { timeouts: { acseMs: SHORT_MS } }))

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.CLOSED_BEFORE_DATA)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.ABORTED_LOCALLY)
			expect(result.association.timeout).toBe(TIMEOUT_KIND.ACSE)
		})

		it("integrace-dicom.md 6.2, 8.3 takes a C-ECHO without a response as not sent, it carries no data set", async () => {
			const result = await client.echo(await targetOf("MUTE-AFTER-DATA", { timeouts: { dimseMs: SHORT_MS } }))
			const record = await recorded()

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.CLOSED_BEFORE_DATA)
			expect(result.association.timeout).toBe(TIMEOUT_KIND.DIMSE)
			expect(record.messages.filter((message) => message.direction === "client-to-peer")).toHaveLength(1)
		})

		it("dorucovaci-jadro.md 5 takes a C-ECHO our own signal ended as no unavailability of the PACS", async () => {
			const controller = new AbortController()
			const pending = client.echo(await targetOf("MUTE-AFTER-DATA"), controller.signal)
			await until(() => (peer?.messagesFromClient() ?? 0) > 0, "the C-ECHO request on the wire")
			controller.abort()
			const result = await pending
			const record = await recorded()

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.ABORTED_LOCALLY)
			expect(record.association.abort?.by).toBe("client-to-peer")
		})

		it("refuses a target that is not one", async () => {
			const target = UNREACHED_TARGET

			await expect(client.echo({ ...target, host: "" })).rejects.toThrow(TypeError)
			await expect(client.echo({ ...target, port: 0 })).rejects.toThrow(RangeError)
			await expect(client.echo({ ...target, calledAeTitle: "A_TITLE_LONGER_THAN_16" })).rejects.toThrow(RangeError)
			await expect(client.echo({ ...target, callingAeTitle: "    " })).rejects.toThrow(RangeError)
			await expect(client.echo({ ...target, callingAeTitle: "BACK\\SLASH" })).rejects.toThrow(RangeError)
		})
	})

	describe("probe", () => {
		it("integrace-dicom.md 6.1 learns what the PACS accepts without sending data", async () => {
			const report = await client.probe(await targetOf("BASELINE"), [
				{ abstractSyntaxUid: VERIFICATION, transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN] },
				{
					abstractSyntaxUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
					transferSyntaxUids: [JPEG_BASELINE, EXPLICIT_VR_LITTLE_ENDIAN],
				},
			])
			const record = await recorded()

			expect(report.association.outcome).toBe(ASSOCIATION_OUTCOME.RELEASED)
			expect(report.association.peerMaxPduLength).toBe(record.association.accept?.maxPduLength)
			expect(report.contexts).toEqual([
				{
					id: 1,
					abstractSyntaxUid: VERIFICATION,
					proposedTransferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN],
					result: 0,
					acceptedTransferSyntaxUid: IMPLICIT_VR_LITTLE_ENDIAN,
				},
				{
					id: 3,
					abstractSyntaxUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
					proposedTransferSyntaxUids: [JPEG_BASELINE, EXPLICIT_VR_LITTLE_ENDIAN],
					result: 0,
					acceptedTransferSyntaxUid: JPEG_BASELINE,
				},
			])
			expect(record.messages).toEqual([])
			expect(record.clientToPeer.pduCounts).toEqual({ "A-ASSOCIATE-RQ": 1, "A-RELEASE-RQ": 1 })
		})

		it("PS3.8 9.3.3.2 reports no transfer syntax for a context the PACS did not accept", async () => {
			const report = await client.probe(await targetOf("AC-UNPROPOSED-TS", { timeouts: SILENT_PEER_TIMEOUTS }), [
				{ abstractSyntaxUid: SECONDARY_CAPTURE_IMAGE_STORAGE, transferSyntaxUids: [JPEG_BASELINE] },
			])

			expect(report.contexts).toHaveLength(1)
			expect(report.contexts[0]?.result).not.toBe(0)
			expect(report.contexts[0]?.acceptedTransferSyntaxUid).toBeUndefined()
		})

		it("does not connect to probe with a signal aborted before", async () => {
			const { target, connections } = await countingTarget()
			const report = await client.probe(
				target,
				[{ abstractSyntaxUid: VERIFICATION, transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN] }],
				AbortSignal.abort(),
			)

			expect(report.contexts).toEqual([])
			expect(report.association.outcome).toBe(ASSOCIATION_OUTCOME.NOT_CONNECTED)
			expect(connections()).toBe(0)
		})

		it("reports no contexts when the association is rejected", async () => {
			const report = await client.probe(await targetOf("NO-SUCH-AE"), [
				{ abstractSyntaxUid: VERIFICATION, transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN] },
			])

			expect(report.contexts).toEqual([])
			expect(report.association.outcome).toBe(ASSOCIATION_OUTCOME.REJECTED)
		})

		it("refuses proposals that are not presentation contexts", async () => {
			const target = UNREACHED_TARGET

			await expect(client.probe(target, [])).rejects.toThrow(RangeError)
			await expect(client.probe(target, [{ abstractSyntaxUid: VERIFICATION, transferSyntaxUids: [] }])).rejects.toThrow(
				RangeError,
			)
			await expect(
				client.probe(target, [{ abstractSyntaxUid: "not a uid", transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN] }]),
			).rejects.toThrow(RangeError)
			await expect(
				client.probe(
					target,
					Array(TOO_MANY_CONTEXTS).fill({
						abstractSyntaxUid: VERIFICATION,
						transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN],
					}),
				),
			).rejects.toThrow(RangeError)
		})
	})

	describe("store", () => {
		it("NAB-359 ADR-005 ř. 23 sends the stored bytes unchanged and reports them", async () => {
			const artifact = artifactOf([JPEG_BASELINE])
			const result = await client.store(await targetOf("BASELINE"), artifact)
			const record = await recorded()
			const stored = storedBytesOf(artifact.variants[0])
			const sent = record.messages.find((message) => message.command?.commandField === C_STORE_RQ)

			expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
			expect(result.statusHex).toBe(SUCCESS_HEX)
			expect(result.datasetBytesFlushed).toBe(stored.length)
			expect(result.datasetSent).toBe(true)
			expect(result.sentDatasetSha256).toBe(artifact.variants[0]?.datasetSha256)
			expect(result.sentDatasetSha256).toBe(sent?.dataset?.sha256)
			expect(result.acceptedTransferSyntax).toBe(JPEG_BASELINE)
			expect(result.presentationContextId).toBe(sent?.contextId)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.RELEASED)
			expect(result.timingsMs.respondedMs).toBeLessThanOrEqual(result.timingsMs.closedMs)
		})

		it("takes the SHA-256 of a variant in upper case hexadecimal digits too", async () => {
			const artifact = artifactOf([JPEG_BASELINE])
			const [variant] = artifact.variants
			const upper = {
				...artifact,
				variants: [{ ...variant, datasetSha256: variant?.datasetSha256.toUpperCase() } as StoredVariant],
			}
			const result = await client.store(await targetOf("BASELINE"), upper)

			expect(result.phase).toBe(DIMSE_PHASE.RESPONSE)
		})

		it("CAP-023-R15 delivers the instance once, in the variant whose context the PACS accepted", async () => {
			const artifact = artifactOf([JPEG_BASELINE, EXPLICIT_VR_LITTLE_ENDIAN])
			const result = await client.store(
				await targetOf("AC-UNPROPOSED-ID", { timeouts: SILENT_PEER_TIMEOUTS }),
				artifact,
			)
			const record = await recorded()
			const stores = record.messages.filter((message) => message.command?.commandField === C_STORE_RQ)

			expect(stores).toHaveLength(1)
			expect(result.acceptedTransferSyntax).toBe(EXPLICIT_VR_LITTLE_ENDIAN)
			expect(result.presentationContextId).toBe(stores[0]?.contextId)
			expect(result.sentDatasetSha256).toBe(artifact.variants[1]?.datasetSha256)
		})

		it.each([
			[
				"a SHA-256 that differs from the stored bytes",
				(artifact: StoredArtifact) => ({ datasetSha256: WRONG_SHA256, artifact }),
			],
			["bytes that are not a part10 file", () => ({ part10: Buffer.from("not a part10 file") })],
			["a transfer syntax other than in its file", () => ({ transferSyntaxUid: EXPLICIT_VR_LITTLE_ENDIAN })],
		])("CAP-023-R09 CAP-023-S19 sends nothing and connects to nothing for a variant with %s", async (_, edit) => {
			const { target, connections } = await countingTarget()
			const artifact = artifactOf([JPEG_BASELINE])
			const [variant] = artifact.variants
			const broken = { ...artifact, variants: [{ ...variant, ...edit(artifact) } as StoredVariant] }
			const result = await client.store(target, broken)

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ARTIFACT_INTEGRITY)
			expect(result.classification).toEqual(STORE_ARTIFACT_INTEGRITY_GOLDEN)
			expect(result.datasetBytesFlushed).toBe(0)
			expect(connections()).toBe(0)
		})

		it.each([
			[
				"whose SOP instance is not the one of its file",
				(artifact: StoredArtifact) => ({ ...artifact, sopInstanceUid: Dataset.generateDerivedUid() }),
			],
			[
				"whose SOP class is not the one of its file",
				(artifact: StoredArtifact) => ({ ...artifact, sopClassUid: VERIFICATION }),
			],
			["without variants", (artifact: StoredArtifact) => ({ ...artifact, variants: [] })],
			[
				"with two variants in one transfer syntax",
				(artifact: StoredArtifact) => ({
					...artifact,
					variants: [artifact.variants[0], artifact.variants[0]] as StoredVariant[],
				}),
			],
		])("CAP-023-R09 sends nothing for an artifact %s", async (_, edit) => {
			const { target, connections } = await countingTarget()
			const result = await client.store(target, edit(artifactOf([JPEG_BASELINE])))

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ARTIFACT_INTEGRITY)
			expect(connections()).toBe(0)
		})

		it("integrace-dicom.md 6.2 does not connect to store with a signal aborted before", async () => {
			const { target, connections } = await countingTarget()
			const result = await client.store(target, artifactOf([JPEG_BASELINE]), AbortSignal.abort())

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
			expect(result.classification).toEqual(STORE_NOT_SENT_GOLDEN)
			expect(connections()).toBe(0)
		})

		it("dorucovaci-jadro.md 5 takes a C-STORE our own signal ended after connecting as no unavailability", async () => {
			const controller = new AbortController()
			const pending = client.store(await targetOf("NO-RESPONSE"), artifactOf([JPEG_BASELINE]), controller.signal)
			await until(() => (peer?.bytesReceived() ?? 0) > 0, "the association request on the wire")
			controller.abort()
			const result = await pending

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
			expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.ABORTED_LOCALLY)
			expect(result.timingsMs.connectedMs).toBeDefined()
		})

		it("CAP-023-R16 sends no dataset byte when no context is accepted with its transfer syntax", async () => {
			const result = await client.store(
				await targetOf("AC-UNPROPOSED-TS", { timeouts: SILENT_PEER_TIMEOUTS }),
				artifactOf([JPEG_BASELINE]),
			)
			const record = await recorded()

			expect(result.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(result.notSentReason).toBe(NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX)
			expect(result.classification).toEqual(STORE_NO_CONTEXT_GOLDEN)
			expect(result.acceptedTransferSyntax).toBeUndefined()
			expect(result.presentationContextId).toBeUndefined()
			expect(record.clientToPeer.pduCounts["P-DATA-TF"]).toBeUndefined()
		})

		it(
			"integrace-dicom.md 6.2 ends as unknown once one dataset byte left, with the SHA-256 of what left",
			async () => {
				const artifact = artifactOf([JPEG_BASELINE], LARGE_PIXEL_BYTES)
				const result = await client.store(await targetOf("ABORT-MID-DATA"), artifact)
				const stored = storedBytesOf(artifact.variants[0])

				expect(result.phase).toBe(DIMSE_PHASE.UNKNOWN)
				expect(result.notSentReason).toBeUndefined()
				expect(result.datasetSent).toBe(false)
				expect(result.datasetBytesFlushed).toBeGreaterThan(0)
				expect(result.datasetBytesFlushed).toBeLessThan(stored.length)
				expect(result.sentDatasetSha256).toBe(sha256(stored.subarray(0, result.datasetBytesFlushed)))
				expect(result.association.outcome).toBe(ASSOCIATION_OUTCOME.ABORTED_BY_PEER)
				expect(result.association.abort).toEqual({ source: expect.any(Number), reason: expect.any(Number) })
			},
			TEST_TIMEOUT_MS,
		)

		it.each([
			["RSP-EARLY-OK", ASSOCIATION_OUTCOME.ABORTED_LOCALLY],
			["FIN-AFTER-DATA", ASSOCIATION_OUTCOME.CLOSED_UNEXPECTEDLY],
		])(
			"integrace-dicom.md 8.1 takes no success from %s, the outcome is unknown",
			async (calledAeTitle, outcome) => {
				const result = await client.store(await targetOf(calledAeTitle), artifactOf([JPEG_BASELINE], LARGE_PIXEL_BYTES))

				expect(result.phase).toBe(DIMSE_PHASE.UNKNOWN)
				expect(result.statusHex).toBeUndefined()
				expect(result.association.outcome).toBe(outcome)
			},
			TEST_TIMEOUT_MS,
		)
	})

	describe("find", () => {
		it("integrace-dicom.md 8.2 takes FF01 as a match and only 0000 as complete", async () => {
			const stream = client.find(await targetOf("FIND-FF01"), studyQuery())
			const matches = await collect(stream)
			const final = await stream.result
			const record = await recorded()

			expect(matches.map((match) => match.statusHex)).toEqual([PENDING_WARNING_HEX])
			expect(final.phase).toBe(DIMSE_PHASE.RESPONSE)
			expect(final.statusHex).toBe(SUCCESS_HEX)
			expect(final.complete).toBe(true)
			expect(final.matches).toBe(1)
			expect(record.association.request?.presentationContexts.map((context) => context.transferSyntaxes)).toEqual([
				[IMPLICIT_VR_LITTLE_ENDIAN],
			])
		})

		it.each([
			["FIND-LATIN1", LATIN1_PATIENT_NAME, "ISO_IR 100", false],
			["FIND-NO-CHARSET", ASCII_PATIENT_NAME, undefined, true],
			["FIND-NESTED-UTF8", NESTED_UTF8_PATIENT_NAME, "ISO_IR 192", false],
			["FIND-EMPTY-SCS", ASCII_PATIENT_NAME, "", true],
		])(
			"CAP-024-R11 integrace-dicom.md 6.4 keeps the character set of %s as it came",
			async (calledAeTitle, patientName, characterSet, isMissing) => {
				const stream = client.find(await targetOf(calledAeTitle), studyQuery())
				const [match] = await collect(stream)

				expect(match?.identifier.PatientName).toEqual([{ Alphabetic: patientName }])
				expect(match?.identifier).not.toHaveProperty("SpecificCharacterSet")
				expect(match?.specificCharacterSet).toBe(characterSet)
				expect(match?.characterSetMissing).toBe(isMissing)
				expect(match?.afterCancel).toBe(false)
				expect((await stream.result).complete).toBe(true)
			},
		)

		it("ADR-003 ř. 29 cancels at the match limit and drops what comes after the cancel", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery({ maxMatches: MAX_MATCHES }))
			const matches = await collect(stream)
			const final = await stream.result

			expect(matches).toHaveLength(MAX_MATCHES)
			expect(matches.every((match) => !match.afterCancel && match.statusHex === PENDING_HEX)).toBe(true)
			expect(final).toMatchObject({
				phase: DIMSE_PHASE.RESPONSE,
				statusHex: CANCEL_HEX,
				complete: false,
				matches: MAX_MATCHES,
				matchesAfterCancel: PENDING_BEFORE_CANCEL - MAX_MATCHES,
				droppedAfterCancel: PENDING_BEFORE_CANCEL - MAX_MATCHES,
				cancelRequested: true,
				cancelReason: CANCEL_REASON.MAX_MATCHES,
			})
			expect(final.association.outcome).toBe(ASSOCIATION_OUTCOME.RELEASED)
		})

		it("integrace-dicom.md 6.1 cancels for the caller and marks the matches that came after the cancel", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery())
			const matches: FindMatch[] = []
			for await (const match of stream) {
				matches.push(match)
				if (matches.length === CALLER_CANCEL_AFTER) {
					stream.cancel()
					stream.cancel()
				}
			}
			const final = await stream.result
			const late = matches.filter((match) => match.afterCancel)

			expect(final.cancelReason).toBe(CANCEL_REASON.CALLER)
			expect(late.length).toBeGreaterThan(0)
			expect(final.statusHex).toBe(CANCEL_HEX)
			expect(final.complete).toBe(false)
			expect(final.matches + late.length).toBe(matches.length)
			expect(final.matchesAfterCancel).toBe(late.length + final.droppedAfterCancel)
			expect(final.matches + final.matchesAfterCancel).toBe(PENDING_BEFORE_CANCEL)
		})

		it("integrace-dicom.md 6.4 cancels when the consumer stops iterating", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery())
			let taken = 0
			for await (const _ of stream) {
				taken += 1
				if (taken === RETURN_AFTER) {
					break
				}
			}
			const final = await stream.result

			expect(final.cancelReason).toBe(CANCEL_REASON.ITERATOR_RETURN)
			expect(final.statusHex).toBe(CANCEL_HEX)
			expect(final.droppedAfterCancel).toBe(final.matchesAfterCancel)
		})

		it("drops what comes after a cancel once the consumer is gone", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery())
			for await (const _ of stream) {
				stream.cancel()
				break
			}
			const final = await stream.result

			expect(final.cancelReason).toBe(CANCEL_REASON.CALLER)
			expect(final.matchesAfterCancel).toBeGreaterThan(0)
			expect(final.droppedAfterCancel).toBe(final.matchesAfterCancel)
		})

		it("ADR-005 ř. 39 takes no result as complete once it was cancelled, even with 0000", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL-OK"), studyQuery({ maxMatches: MAX_MATCHES }))
			await collect(stream)
			const final = await stream.result

			expect(final.statusHex).toBe(SUCCESS_HEX)
			expect(final.cancelRequested).toBe(true)
			expect(final.complete).toBe(false)
			expect(final.classification).toEqual(FIND_CANCELLED_GOLDEN)
		})

		it("integrace-dicom.md 6.3 reads again only once the consumer took the queue down to a quarter", async () => {
			const pause = vi.spyOn(Client.prototype, "pauseReceiving")
			const resume = vi.spyOn(Client.prototype, "resumeReceiving")
			try {
				const stream = client.find(
					await targetOf("FIND-CANCEL"),
					studyQuery({ highWaterMark: SMALL_HIGH_WATER_MARK, consumerStallMs: LONG_STALL_MS }),
				)
				const iterator = stream[Symbol.asyncIterator]()
				await until(() => pause.mock.calls.length === 1, "the pause at the high water mark")
				const resumedAfter: number[] = []
				for (let taken = 1; taken <= TAKEN_BEFORE_RESUME; taken += 1) {
					await iterator.next()
					resumedAfter.push(resume.mock.calls.length)
				}
				stream.cancel()
				await iterator.return?.()
				await stream.result

				expect(resumedAfter).toEqual([...Array(TAKEN_BEFORE_RESUME - 1).fill(0), 1])
			} finally {
				pause.mockRestore()
				resume.mockRestore()
			}
		})

		it("integrace-dicom.md 6.3 PS3.8 9.3.5 holds the queue at the high water mark inside one PDU of more matches", async () => {
			const pause = vi.spyOn(Client.prototype, "pauseReceiving")
			try {
				const stream = client.find(
					await targetOf("FIND-PACKED", { timeouts: SILENT_PEER_TIMEOUTS }),
					studyQuery({ consumerStallMs: LONG_STALL_MS }),
				)
				await until(() => pause.mock.calls.length === 1, "the pause at the high water mark")
				const matches = await collect(stream)
				const final = await stream.result

				expect(PACKED_PENDING).toBeGreaterThan(SPEC_HIGH_WATER_MARK)
				expect(matches).toHaveLength(PACKED_PENDING)
				expect(final.maxQueued).toBe(SPEC_HIGH_WATER_MARK)
				expect(final.complete).toBe(true)
				expect(final.association.outcome).toBe(ASSOCIATION_OUTCOME.RELEASED)
			} finally {
				pause.mockRestore()
			}
		})

		it("integrace-dicom.md 6.3 holds the PACS at the high water mark and cancels for a stalled consumer", async () => {
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery({ consumerStallMs: STALL_MS }))
			const final = await stream.result

			expect(final.cancelReason).toBe(CANCEL_REASON.CONSUMER_STALL)
			expect(final.maxQueued).toBe(SPEC_HIGH_WATER_MARK)
			expect(final.statusHex).toBe(CANCEL_HEX)
			expect(final.matches + final.matchesAfterCancel).toBe(PENDING_BEFORE_CANCEL)
		})

		it(
			"integrace-dicom.md 6.3 keeps at most the high water mark of matches for a slow consumer",
			async () => {
				const stream = client.find(
					await targetOf("FIND-FLOOD"),
					studyQuery({ maxMatches: FLOOD_MATCHES, highWaterMark: SMALL_HIGH_WATER_MARK, cancelGraceMs: SHORT_MS }),
				)
				let taken = 0
				for await (const _ of stream) {
					taken += 1
					await wait(SLOW_CONSUMER_MS)
				}
				const final = await stream.result

				expect(taken).toBe(FLOOD_MATCHES)
				expect(final.maxQueued).toBeLessThanOrEqual(SMALL_HIGH_WATER_MARK)
				expect(final.cancelReason).toBe(CANCEL_REASON.MAX_MATCHES)
			},
			TEST_TIMEOUT_MS,
		)

		it("integrace-dicom.md 6.3 aborts when the PACS does not end the query in the cancel grace", async () => {
			const stream = client.find(
				await targetOf("FIND-FLOOD"),
				studyQuery({ maxMatches: MAX_MATCHES, cancelGraceMs: SHORT_MS }),
			)
			const matches = await collect(stream)
			const final = await stream.result
			const record = await recorded()

			expect(matches).toHaveLength(MAX_MATCHES)
			expect(final.phase).toBe(DIMSE_PHASE.UNKNOWN)
			expect(final.complete).toBe(false)
			expect(final.association.outcome).toBe(ASSOCIATION_OUTCOME.ABORTED_LOCALLY)
			expect(record.association.abort?.by).toBe("client-to-peer")
		})

		it("integrace-dicom.md 6.1 cancels on the signal", async () => {
			const controller = new AbortController()
			const stream = client.find(await targetOf("FIND-CANCEL"), studyQuery(), controller.signal)
			let taken = 0
			for await (const _ of stream) {
				taken += 1
				if (taken === 1) {
					controller.abort()
				}
			}
			const final = await stream.result

			expect(final.cancelReason).toBe(CANCEL_REASON.SIGNAL)
			expect(final.statusHex).toBe(CANCEL_HEX)
		})

		it("integrace-dicom.md 8.2 ends as unknown and incomplete without a final response", async () => {
			const stream = client.find(await targetOf("FIND-NO-FINAL", { timeouts: { dimseMs: SHORT_MS } }), studyQuery())
			const matches = await collect(stream)
			const final = await stream.result

			expect(matches.length).toBeGreaterThan(0)
			expect(final.phase).toBe(DIMSE_PHASE.UNKNOWN)
			expect(final.complete).toBe(false)
			expect(final.association.timeout).toBe(TIMEOUT_KIND.DIMSE)
		})

		it("ADR-005 ř. 39 never takes a data set that cannot be read whole as a result", async () => {
			const stream = client.find(await targetOf("FIND-DEEP-NEST"), studyQuery())
			const matches = await collect(stream)
			const final = await stream.result

			expect(matches).toEqual([])
			expect(final.phase).toBe(DIMSE_PHASE.UNKNOWN)
			expect(final.complete).toBe(false)
		})

		it("integrace-dicom.md 6.1 resolves without connecting for a signal aborted before", async () => {
			const { target, connections } = await countingTarget()
			const stream = client.find(target, studyQuery(), AbortSignal.abort())
			const final = await stream.result

			expect(await collect(stream)).toEqual([])
			expect(final.phase).toBe(DIMSE_PHASE.NOT_SENT)
			expect(final.notSentReason).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
			expect(final.cancelRequested).toBe(true)
			expect(final.cancelReason).toBe(CANCEL_REASON.SIGNAL)
			expect(connections()).toBe(0)
		})

		it("refuses limits that are not positive integers", () => {
			const target = UNREACHED_TARGET

			expect(() => client.find(target, studyQuery({ maxMatches: 0 }))).toThrow(RangeError)
			expect(() => client.find(target, studyQuery({ highWaterMark: 1.5 }))).toThrow(RangeError)
			expect(() => client.find(target, studyQuery({ consumerStallMs: -1 }))).toThrow(RangeError)
			expect(() => client.find(target, studyQuery({ cancelGraceMs: Number.NaN }))).toThrow(RangeError)
		})
	})
})
