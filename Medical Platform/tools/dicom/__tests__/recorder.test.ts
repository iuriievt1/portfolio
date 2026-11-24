import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { COMMAND_FIELD, DATA_SET_PRESENT, emptyCommand, encodeCommand, STATUS } from "../dimse"
import { UNDEFINED_PDU_TYPE } from "../hostile/cases"
import {
	encodeAbort,
	encodeAssociateAccept,
	encodeAssociateReject,
	encodeAssociateRequest,
	encodeDataPdu,
	encodePdu,
	encodeReleaseRequest,
	encodeReleaseResponse,
	fragmentMessage,
	PDU_TYPE,
	SHORT_PDU_BODY_LENGTH,
} from "../pdu"
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID, HOSTILE_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import {
	APPLICATION_CONTEXT_NAME,
	IMPLICIT_VR_LITTLE_ENDIAN,
	JPEG_BASELINE,
	VERIFICATION,
	VL_PHOTOGRAPHIC_IMAGE_STORAGE as VL_PHOTOGRAPHIC,
} from "../uids"
import { type ConnectionRecord, ConnectionRecorder, type Direction, hexWord } from "../wire/recorder"

const STORE_CONTEXT = 3
const MESSAGE_ID = 7
const SOP_INSTANCE_UID = "2.25.42"
const PEER_MAX_PDU_LENGTH = 16_378
const OWN_MAX_PDU_LENGTH = 16_384
const DATASET_LENGTH = 40_000
const CHUNK_SIZES = [1, 7, 100, 3000, 16_384]

const DATASET = Buffer.from(Array.from({ length: DATASET_LENGTH }, (_, index) => index % 251))

const REQUEST = encodeAssociateRequest({
	calledAeTitle: "AMIS",
	callingAeTitle: CALLING_AE_TITLE,
	applicationContext: APPLICATION_CONTEXT_NAME,
	presentationContexts: [
		{ id: 1, abstractSyntax: VERIFICATION, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
		{ id: STORE_CONTEXT, abstractSyntax: VL_PHOTOGRAPHIC, transferSyntaxes: [JPEG_BASELINE] },
	],
	maxPduLength: OWN_MAX_PDU_LENGTH,
	implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: undefined,
})

const ACCEPT = encodeAssociateAccept({
	calledAeTitle: "AMIS",
	callingAeTitle: CALLING_AE_TITLE,
	presentationContexts: [
		{ id: 1, result: 0, transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN },
		{ id: STORE_CONTEXT, result: 0, transferSyntax: JPEG_BASELINE },
	],
	maxPduLength: PEER_MAX_PDU_LENGTH,
	implementationClassUid: HOSTILE_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: undefined,
})

const STORE_COMMAND = encodeCommand({
	...emptyCommand(COMMAND_FIELD.C_STORE_RQ),
	messageId: MESSAGE_ID,
	affectedSopClassUid: VL_PHOTOGRAPHIC,
	affectedSopInstanceUid: SOP_INSTANCE_UID,
	dataSetType: DATA_SET_PRESENT,
})

const STORE_RESPONSE = encodeCommand({
	...emptyCommand(COMMAND_FIELD.C_STORE_RSP),
	messageIdBeingRespondedTo: MESSAGE_ID,
	affectedSopClassUid: VL_PHOTOGRAPHIC,
	affectedSopInstanceUid: SOP_INSTANCE_UID,
	status: STATUS.SUCCESS,
})

const CLIENT_DATA = [
	...fragmentMessage(STORE_CONTEXT, true, STORE_COMMAND, PEER_MAX_PDU_LENGTH, OWN_MAX_PDU_LENGTH),
	...fragmentMessage(STORE_CONTEXT, false, DATASET, PEER_MAX_PDU_LENGTH, OWN_MAX_PDU_LENGTH),
]

const EXCHANGE: [Direction, Buffer][] = [
	["client-to-peer", REQUEST],
	["peer-to-client", ACCEPT],
	["client-to-peer", Buffer.concat(CLIENT_DATA)],
	["peer-to-client", Buffer.concat(fragmentMessage(STORE_CONTEXT, true, STORE_RESPONSE, OWN_MAX_PDU_LENGTH, 0))],
	["client-to-peer", encodeReleaseRequest()],
	["peer-to-client", encodeReleaseResponse()],
]

function feed(recorder: ConnectionRecorder, direction: Direction, bytes: Buffer, sizes: readonly number[]): void {
	let offset = 0
	for (let index = 0; offset < bytes.length; index += 1) {
		const size = sizes[index % sizes.length] ?? bytes.length
		recorder.receive(direction, bytes.subarray(offset, offset + size))
		offset += size
	}
}

function recordOf(sizes: readonly number[]): ConnectionRecord {
	const recorder = new ConnectionRecorder()
	for (const [direction, bytes] of EXCHANGE) {
		feed(recorder, direction, bytes, sizes)
	}
	return recorder.finish()
}

function withoutTimes(record: ConnectionRecord) {
	return { ...record, pdus: record.pdus.map(({ atMs: _, ...entry }) => entry) }
}

describe("wire recorder integrace-dicom.md 9.1, 11.1", () => {
	it("records the association, every DIMSE message and the SHA-256 of the data set bytes that went through", () => {
		const record = recordOf([Number.MAX_SAFE_INTEGER])

		expect(record.association.request?.calledAeTitle).toBe("AMIS")
		expect(record.association.accept?.maxPduLength).toBe(PEER_MAX_PDU_LENGTH)
		expect(record.messages).toEqual([
			{
				direction: "client-to-peer",
				contextId: STORE_CONTEXT,
				transferSyntax: JPEG_BASELINE,
				command: {
					commandField: hexWord(COMMAND_FIELD.C_STORE_RQ),
					messageId: MESSAGE_ID,
					messageIdBeingRespondedTo: undefined,
					statusHex: undefined,
					affectedSopClassUid: VL_PHOTOGRAPHIC,
					affectedSopInstanceUid: SOP_INSTANCE_UID,
					dataSetPresent: true,
				},
				problems: [],
				dataset: {
					bytes: DATASET_LENGTH,
					sha256: createHash("sha256").update(DATASET).digest("hex"),
					fragments: 3,
					maxFragment: PEER_MAX_PDU_LENGTH - 6,
				},
				complete: true,
				firstSequence: 3,
				lastSequence: 6,
			},
			{
				direction: "peer-to-client",
				contextId: STORE_CONTEXT,
				transferSyntax: JPEG_BASELINE,
				command: {
					commandField: hexWord(COMMAND_FIELD.C_STORE_RSP),
					messageId: undefined,
					messageIdBeingRespondedTo: MESSAGE_ID,
					statusHex: hexWord(STATUS.SUCCESS),
					affectedSopClassUid: VL_PHOTOGRAPHIC,
					affectedSopInstanceUid: SOP_INSTANCE_UID,
					dataSetPresent: false,
				},
				problems: [],
				dataset: undefined,
				complete: true,
				firstSequence: 7,
				lastSequence: 7,
			},
		])
		expect(record.association.releaseRequestedBy).toBe("client-to-peer")
		expect(record.association.releaseResponded).toBe(true)
	})

	it("integrace-dicom.md 6.3, 10 records counts and the largest P-DATA-TF of each direction", () => {
		const record = recordOf([Number.MAX_SAFE_INTEGER])

		expect(record.clientToPeer.pduCounts).toEqual({ "A-ASSOCIATE-RQ": 1, "P-DATA-TF": 4, "A-RELEASE-RQ": 1 })
		expect(record.clientToPeer.maxDataPduLength).toBe(PEER_MAX_PDU_LENGTH)
		expect(record.peerToClient.pduCounts).toEqual({ "A-ASSOCIATE-AC": 1, "P-DATA-TF": 1, "A-RELEASE-RP": 1 })
		expect(record.clientToPeer.bytes).toBe(
			REQUEST.length + Buffer.concat(CLIENT_DATA).length + encodeReleaseRequest().length,
		)
		expect(record.pdus.filter((pdu) => pdu.direction === "client-to-peer").map((pdu) => pdu.offset)).toEqual([
			0,
			REQUEST.length,
			REQUEST.length + (CLIENT_DATA[0]?.length ?? 0),
			REQUEST.length + (CLIENT_DATA[0]?.length ?? 0) + (CLIENT_DATA[1]?.length ?? 0),
			REQUEST.length + (CLIENT_DATA[0]?.length ?? 0) + (CLIENT_DATA[1]?.length ?? 0) + (CLIENT_DATA[2]?.length ?? 0),
			REQUEST.length + Buffer.concat(CLIENT_DATA).length,
		])
	})

	it("records the same whatever way TCP splits the bytes", () => {
		expect(withoutTimes(recordOf([1]))).toEqual(withoutTimes(recordOf([Number.MAX_SAFE_INTEGER])))
		expect(withoutTimes(recordOf(CHUNK_SIZES))).toEqual(withoutTimes(recordOf([Number.MAX_SAFE_INTEGER])))
	})

	it("integrace-dicom.md 6.3 records an oversized P-DATA-TF from its header without buffering it", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive("peer-to-client", Buffer.from([PDU_TYPE.DATA_TF, 0, 0xff, 0xff, 0xff, 0xf0, 0, 0]))
		const record = recorder.finish()

		expect(record.pdus).toMatchObject([{ type: "P-DATA-TF", declaredLength: 0xff_ff_ff_f0 }])
		expect(record.peerToClient.maxDataPduLength).toBe(0xff_ff_ff_f0)
		expect(record.peerToClient.problems[0]?.problem).toMatch(/connection ended/)
	})

	it("notes a non-data PDU over the recorded limit and keeps framing the next PDU", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive("peer-to-client", encodePdu(PDU_TYPE.ASSOCIATE_AC, Buffer.alloc(1_048_577)))
		recorder.receive("peer-to-client", encodeReleaseResponse())
		const record = recorder.finish()

		expect(record.peerToClient.problems).toHaveLength(1)
		expect(record.association.accept).toBeUndefined()
		expect(record.association.releaseResponded).toBe(true)
	})

	it("notes a PDV that runs past its PDU and decodes the next PDU", () => {
		const overrun = Buffer.from(
			encodeDataPdu([{ contextId: STORE_CONTEXT, isCommand: true, isLast: true, data: STORE_RESPONSE }]),
		)
		overrun.writeUInt32BE(overrun.length, 6)
		const recorder = new ConnectionRecorder()
		recorder.receive("peer-to-client", Buffer.concat([ACCEPT, overrun]))
		recorder.receive(
			"peer-to-client",
			encodeDataPdu([{ contextId: STORE_CONTEXT, isCommand: true, isLast: true, data: STORE_RESPONSE }]),
		)
		const record = recorder.finish()

		expect(record.peerToClient.problems.map((problem) => problem.problem)).toEqual([
			`PDV declares ${overrun.length} bytes past its PDU`,
		])
		expect(record.messages.map((message) => [message.command?.statusHex, message.complete])).toEqual([
			[hexWord(STATUS.SUCCESS), true],
		])
	})

	it("skips an undefined PDU type by its length and frames the next PDU", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive(
			"peer-to-client",
			Buffer.concat([encodePdu(UNDEFINED_PDU_TYPE, Buffer.alloc(SHORT_PDU_BODY_LENGTH)), encodeReleaseResponse()]),
		)
		const record = recorder.finish()

		expect(record.pdus.map((pdu) => pdu.type)).toEqual(["unknown-0x0a", "A-RELEASE-RP"])
	})

	it("keeps a data set without a command and a command set that does not decode as incomplete messages", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive(
			"client-to-peer",
			Buffer.concat([
				encodeDataPdu([{ contextId: 1, isCommand: false, isLast: true, data: Buffer.alloc(10) }]),
				encodeDataPdu([{ contextId: 1, isCommand: true, isLast: true, data: Buffer.alloc(5) }]),
			]),
		)
		const record = recorder.finish()

		expect(record.messages.map((message) => [message.command, message.complete, message.problems.length])).toEqual([
			[undefined, false, 0],
			[undefined, false, 1],
		])
	})

	it("notes a connection that ended inside a PDU header", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive("client-to-peer", encodeReleaseRequest().subarray(0, 3))
		const record = recorder.finish()

		expect(record.pdus).toEqual([])
		expect(record.clientToPeer.problems.map((problem) => problem.problem)).toEqual([
			"connection ended 3 bytes before the PDU header end",
		])
	})

	it("PS3.8 9.3.5 notes a P-DATA-TF without a PDV", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive("peer-to-client", encodePdu(PDU_TYPE.DATA_TF, Buffer.alloc(0)))
		const record = recorder.finish()

		expect(record.peerToClient.problems.map((problem) => problem.problem)).toEqual(["P-DATA-TF has no PDV"])
	})

	it("PS3.8 9.3.4, 9.3.8 notes an A-ASSOCIATE-RJ or A-ABORT whose body is not four bytes and reads the right ones", () => {
		const recorder = new ConnectionRecorder()
		recorder.receive(
			"peer-to-client",
			Buffer.concat([
				encodePdu(PDU_TYPE.ASSOCIATE_RJ, Buffer.from([0, 1, 1])),
				encodePdu(PDU_TYPE.ABORT, Buffer.alloc(5)),
				encodeAssociateReject(1, 1, 7),
				encodeAbort(2, 0),
			]),
		)
		const record = recorder.finish()

		expect(record.peerToClient.problems.map((problem) => problem.problem)).toEqual([
			"A-ASSOCIATE-RJ has 3 bytes, not 4",
			"A-ABORT has 5 bytes, not 4",
		])
		expect(record.association.reject).toEqual({ result: 1, source: 1, reason: 7 })
		expect(record.association.abort).toEqual({ by: "peer-to-client", source: 2, reason: 0 })
	})

	it("integrace-dicom.md 6.2 writes command fields and statuses as four upper-case hex digits", () => {
		expect([hexWord(0), hexWord(0xa7_00), hexWord(COMMAND_FIELD.C_ECHO_RSP)]).toEqual(["0000", "A700", "8030"])
	})
})
