import { describe, expect, it } from "vitest"
import {
	ASSOCIATE_FIXED_LENGTH,
	type AssociateRequest,
	encodeAbort,
	encodeAssociateAccept,
	encodeAssociateReject,
	encodeAssociateRequest,
	encodeDataPdu,
	fragmentMessage,
	ITEM_HEADER_LENGTH,
	ITEM_TYPE,
	PDU_HEADER_LENGTH,
	PDU_TYPE,
	PDV_HEADER_LENGTH,
	PduFormatError,
	PduLengthError,
	PduReader,
	PRESENTATION_CONTEXT_RESULT,
	PROFILE_MAX_PDU_LENGTH,
	parseAssociateAccept,
	parseAssociateRequest,
	parseDataPdu,
} from "../pdu"
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID, HOSTILE_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import {
	APPLICATION_CONTEXT_NAME,
	ENCAPSULATED_PDF_STORAGE,
	EXPLICIT_VR_LITTLE_ENDIAN,
	IMPLICIT_VR_LITTLE_ENDIAN,
	VERIFICATION,
} from "../uids"

// PS3.8 9.3, D.1

const REQUEST: AssociateRequest = {
	calledAeTitle: "AMIS",
	callingAeTitle: CALLING_AE_TITLE,
	applicationContext: APPLICATION_CONTEXT_NAME,
	presentationContexts: [
		{ id: 1, abstractSyntax: VERIFICATION, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
		{
			id: 3,
			abstractSyntax: ENCAPSULATED_PDF_STORAGE,
			transferSyntaxes: [EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN],
		},
	],
	maxPduLength: PROFILE_MAX_PDU_LENGTH,
	implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: "VULNA_TEST",
}
const AC_RESULT_OFFSET = 2
const CALLED_AE_TITLE_OFFSET = 4
const CALLING_AE_TITLE_OFFSET = 20
const AE_TITLE_FIELD_LENGTH = 16
const PROTOCOL_VERSION = 1
const LENGTH_FIELD_OFFSET = 2
const MAXIMUM_LENGTH_ITEM = Buffer.from([ITEM_TYPE.MAXIMUM_LENGTH, 0, 0, 4])

function onlyPdu(bytes: Buffer) {
	const pdus = new PduReader(Number.MAX_SAFE_INTEGER).push(bytes)
	expect(pdus).toHaveLength(1)
	const [pdu] = pdus
	if (pdu === undefined) {
		throw new Error("no PDU")
	}
	return pdu
}

describe("PDU codec PS3.8 9.3", () => {
	it("reads back an A-ASSOCIATE-RQ it wrote", () => {
		const pdu = onlyPdu(encodeAssociateRequest(REQUEST))

		expect(pdu.type).toBe(PDU_TYPE.ASSOCIATE_RQ)
		expect(parseAssociateRequest(pdu.body)).toEqual(REQUEST)
	})

	it("reads back an A-ASSOCIATE-AC it wrote", () => {
		const accept = {
			calledAeTitle: "AMIS",
			callingAeTitle: CALLING_AE_TITLE,
			presentationContexts: [
				{ id: 1, result: 0, transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN },
				{
					id: 3,
					result: PRESENTATION_CONTEXT_RESULT.TRANSFER_SYNTAXES_NOT_SUPPORTED,
					transferSyntax: EXPLICIT_VR_LITTLE_ENDIAN,
				},
			],
			maxPduLength: PROFILE_MAX_PDU_LENGTH,
			implementationClassUid: HOSTILE_IMPLEMENTATION_CLASS_UID,
			implementationVersionName: undefined,
		}

		expect(parseAssociateAccept(onlyPdu(encodeAssociateAccept(accept)).body)).toEqual(accept)
	})

	it("joins a PDU split across chunks and splits PDUs sharing a chunk", () => {
		const reject = encodeAssociateReject(1, 1, 7)
		const abort = encodeAbort(2, 0)
		const reader = new PduReader(1024)

		expect(reader.push(reject.subarray(0, 3))).toEqual([])
		const pdus = reader.push(Buffer.concat([reject.subarray(3), abort]))

		expect(pdus.map((pdu) => [pdu.type, [...pdu.body]])).toEqual([
			[PDU_TYPE.ASSOCIATE_RJ, [0, 1, 1, 7]],
			[PDU_TYPE.ABORT, [0, 0, 2, 0]],
		])
	})

	it("integrace-dicom.md 6.3 refuses a declared length over the limit from the header alone", () => {
		const header = Buffer.alloc(PDU_HEADER_LENGTH)
		header.writeUInt8(PDU_TYPE.DATA_TF, 0)
		header.writeUInt32BE(PROFILE_MAX_PDU_LENGTH + 1, 2)

		expect(() => new PduReader(PROFILE_MAX_PDU_LENGTH).push(header)).toThrow(PduLengthError)
	})

	it("refuses a PDV that runs past its PDU", () => {
		const pdu = onlyPdu(encodeDataPdu([{ contextId: 1, isCommand: true, isLast: true, data: Buffer.alloc(10) }]))
		const body = Buffer.from(pdu.body)
		body.writeUInt32BE(100, 0)

		expect(() => parseDataPdu(body)).toThrow(PduFormatError)
	})

	it("PS3.8 D.1 fragments within the peer's maximum length and marks only the last fragment", () => {
		const pdus = fragmentMessage(5, false, Buffer.alloc(40_000, 1), 16_378, PROFILE_MAX_PDU_LENGTH).map(onlyPdu)

		expect(pdus.every((pdu) => pdu.body.length <= 16_378)).toBe(true)
		const values = pdus.flatMap((pdu) => parseDataPdu(pdu.body))
		expect(values.map((value) => value.isLast)).toEqual([false, false, true])
		expect(values.reduce((total, value) => total + value.data.length, 0)).toBe(40_000)
		expect(values.every((value) => value.contextId === 5 && !value.isCommand)).toBe(true)
	})

	it("PS3.8 D.1 uses its own maximum when the peer offers no limit", () => {
		const pdus = fragmentMessage(1, true, Buffer.alloc(20_000), 0, PROFILE_MAX_PDU_LENGTH).map(onlyPdu)

		expect(pdus.map((pdu) => pdu.body.length)).toEqual([PROFILE_MAX_PDU_LENGTH, 3628])
	})

	it("sends an empty message as one last fragment", () => {
		const [pdu] = fragmentMessage(1, false, Buffer.alloc(0), PROFILE_MAX_PDU_LENGTH, PROFILE_MAX_PDU_LENGTH).map(
			onlyPdu,
		)

		expect(pdu === undefined ? [] : parseDataPdu(pdu.body)).toEqual([
			{ contextId: 1, isCommand: false, isLast: true, data: Buffer.alloc(0) },
		])
	})

	it("PS3.8 9.3.2 lays out the A-ASSOCIATE-RQ fixed fields and its first items", () => {
		const { body } = onlyPdu(encodeAssociateRequest(REQUEST))
		const applicationContext = body.subarray(ASSOCIATE_FIXED_LENGTH)
		const presentationContext = applicationContext.subarray(ITEM_HEADER_LENGTH + APPLICATION_CONTEXT_NAME.length)

		expect(body.readUInt16BE(0)).toBe(PROTOCOL_VERSION)
		expect(body.toString("ascii", CALLED_AE_TITLE_OFFSET, CALLED_AE_TITLE_OFFSET + AE_TITLE_FIELD_LENGTH)).toBe(
			"AMIS".padEnd(AE_TITLE_FIELD_LENGTH, " "),
		)
		expect(body.toString("ascii", CALLING_AE_TITLE_OFFSET, CALLING_AE_TITLE_OFFSET + AE_TITLE_FIELD_LENGTH)).toBe(
			CALLING_AE_TITLE.padEnd(AE_TITLE_FIELD_LENGTH, " "),
		)
		expect([applicationContext.readUInt8(0), applicationContext.readUInt16BE(2)]).toEqual([
			ITEM_TYPE.APPLICATION_CONTEXT,
			APPLICATION_CONTEXT_NAME.length,
		])
		expect([presentationContext.readUInt8(0), presentationContext.readUInt8(ITEM_HEADER_LENGTH)]).toEqual([
			ITEM_TYPE.PRESENTATION_CONTEXT_RQ,
			REQUEST.presentationContexts[0]?.id,
		])
	})

	it("PS3.8 9.3.3.2 writes the result of a presentation context at its third byte", () => {
		const { body } = onlyPdu(
			encodeAssociateAccept({
				calledAeTitle: "AMIS",
				callingAeTitle: CALLING_AE_TITLE,
				presentationContexts: [
					{ id: 3, result: PRESENTATION_CONTEXT_RESULT.TRANSFER_SYNTAXES_NOT_SUPPORTED, transferSyntax: "" },
				],
				maxPduLength: PROFILE_MAX_PDU_LENGTH,
				implementationClassUid: HOSTILE_IMPLEMENTATION_CLASS_UID,
				implementationVersionName: undefined,
			}),
		)
		const context = body.subarray(ASSOCIATE_FIXED_LENGTH + ITEM_HEADER_LENGTH + APPLICATION_CONTEXT_NAME.length)

		expect(context.readUInt8(0)).toBe(ITEM_TYPE.PRESENTATION_CONTEXT_AC)
		expect(context.readUInt8(ITEM_HEADER_LENGTH + AC_RESULT_OFFSET)).toBe(
			PRESENTATION_CONTEXT_RESULT.TRANSFER_SYNTAXES_NOT_SUPPORTED,
		)
	})

	it("PS3.8 9.3.5, E.2 writes a PDV as its length, context and control header bits", () => {
		const { body } = onlyPdu(encodeDataPdu([{ contextId: 5, isCommand: true, isLast: true, data: Buffer.from([9]) }]))

		expect([...body]).toEqual([0, 0, 0, PDV_HEADER_LENGTH - 4 + 1, 5, 0b11, 9])
		expect(
			[...onlyPdu(encodeDataPdu([{ contextId: 5, isCommand: false, isLast: false, data: Buffer.alloc(0) }])).body].at(
				-1,
			),
		).toBe(0)
	})

	it("refuses an A-ASSOCIATE-RQ without an application context and a presentation context without abstract syntax", () => {
		const { body } = onlyPdu(encodeAssociateRequest(REQUEST))
		const withoutApplicationContext = Buffer.concat([
			body.subarray(0, ASSOCIATE_FIXED_LENGTH),
			body.subarray(ASSOCIATE_FIXED_LENGTH + ITEM_HEADER_LENGTH + APPLICATION_CONTEXT_NAME.length),
		])
		const withoutAbstractSyntax = Buffer.from(body)
		withoutAbstractSyntax.writeUInt8(
			ITEM_TYPE.TRANSFER_SYNTAX,
			ASSOCIATE_FIXED_LENGTH + ITEM_HEADER_LENGTH + APPLICATION_CONTEXT_NAME.length + ITEM_HEADER_LENGTH * 2,
		)

		expect(() => parseAssociateRequest(withoutApplicationContext)).toThrow(/without application context/)
		expect(() => parseAssociateRequest(withoutAbstractSyntax)).toThrow(/without abstract syntax/)
		expect(() => parseAssociateRequest(body.subarray(0, ASSOCIATE_FIXED_LENGTH - 1))).toThrow(PduFormatError)
	})

	it("refuses a maximum length item that is not four bytes", () => {
		const { body } = onlyPdu(encodeAssociateRequest(REQUEST))
		const userInformation = body.lastIndexOf(Buffer.from([ITEM_TYPE.USER_INFORMATION]))
		const maximumLength = body.indexOf(MAXIMUM_LENGTH_ITEM, userInformation)
		const shortened = Buffer.concat([
			body.subarray(0, maximumLength + ITEM_HEADER_LENGTH),
			body.subarray(maximumLength + ITEM_HEADER_LENGTH + 1),
		])
		shortened.writeUInt16BE(
			shortened.readUInt16BE(userInformation + LENGTH_FIELD_OFFSET) - 1,
			userInformation + LENGTH_FIELD_OFFSET,
		)
		shortened.writeUInt16BE(MAXIMUM_LENGTH_ITEM.length - 1, maximumLength + LENGTH_FIELD_OFFSET)

		expect(() => parseAssociateRequest(shortened)).toThrow("maximum length item has 3 bytes")
	})

	it("refuses an AE title over 16 characters and a maximum length that leaves no room for data", () => {
		expect(() => encodeAssociateRequest({ ...REQUEST, calledAeTitle: "A".repeat(AE_TITLE_FIELD_LENGTH + 1) })).toThrow(
			PduFormatError,
		)
		expect(() => fragmentMessage(1, false, Buffer.alloc(1), PDV_HEADER_LENGTH, PROFILE_MAX_PDU_LENGTH)).toThrow(
			PduFormatError,
		)
	})
})
