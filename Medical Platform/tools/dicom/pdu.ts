import { APPLICATION_CONTEXT_NAME } from "./uids"

// PS3.8 9.3, ADR-017, integrace-dicom.md 6.3, 11

export const PDU_TYPE = {
	ASSOCIATE_RQ: 0x01,
	ASSOCIATE_AC: 0x02,
	ASSOCIATE_RJ: 0x03,
	DATA_TF: 0x04,
	RELEASE_RQ: 0x05,
	RELEASE_RP: 0x06,
	ABORT: 0x07,
} as const

export const ITEM_TYPE = {
	APPLICATION_CONTEXT: 0x10,
	PRESENTATION_CONTEXT_RQ: 0x20,
	PRESENTATION_CONTEXT_AC: 0x21,
	ABSTRACT_SYNTAX: 0x30,
	TRANSFER_SYNTAX: 0x40,
	USER_INFORMATION: 0x50,
	MAXIMUM_LENGTH: 0x51,
	IMPLEMENTATION_CLASS_UID: 0x52,
	IMPLEMENTATION_VERSION_NAME: 0x55,
} as const

// PS3.8 9.3.3.2
export const PRESENTATION_CONTEXT_RESULT = {
	ACCEPTANCE: 0,
	TRANSFER_SYNTAXES_NOT_SUPPORTED: 4,
} as const

// PS3.8 9.3.4
export const REJECT_RESULT = { PERMANENT: 1, TRANSIENT: 2 } as const
export const REJECT_SOURCE = { SERVICE_USER: 1, SERVICE_PROVIDER_ACSE: 2, SERVICE_PROVIDER_PRESENTATION: 3 } as const
export const REJECT_REASON = { CALLED_AE_TITLE_NOT_RECOGNIZED: 7 } as const

// PS3.8 9.3.8
export const ABORT_SOURCE = { SERVICE_PROVIDER: 2 } as const

// integrace-dicom.md 6.3, 10, TS-059
export const PROFILE_MAX_PDU_LENGTH = 16_384
export const PDU_HEADER_LENGTH = 6
export const PDV_HEADER_LENGTH = 6
export const ITEM_HEADER_LENGTH = 4
export const AE_TITLE_LENGTH = 16
export const ASSOCIATE_FIXED_LENGTH = 68
export const PDV_LENGTH_FIELD = 4
export const PDV_COMMAND_FLAG = 0x01
export const PDV_LAST_FLAG = 0x02
// PS3.8 D.1
export const UNLIMITED_PDU_LENGTH = 0

const PROTOCOL_VERSION = 0x00_01
const CALLED_AE_TITLE_OFFSET = 4
const CALLING_AE_TITLE_OFFSET = 20
const PRESENTATION_CONTEXT_FIXED_LENGTH = 4
const PRESENTATION_CONTEXT_RESULT_OFFSET = 2
const MAXIMUM_LENGTH_VALUE_LENGTH = 4
export const PDV_CONTEXT_OFFSET = 4
export const PDV_CONTROL_OFFSET = 5
// PS3.8 9.3.4, 9.3.6, 9.3.7, 9.3.8
export const SHORT_PDU_BODY_LENGTH = 4
export const REJECT_FIELD = { RESULT: 1, SOURCE: 2, REASON: 3 } as const
export const ABORT_FIELD = { SOURCE: 2, REASON: 3 } as const
const RESERVED = 0
const UID_PADDING = /[\0 ]+$/

export class PduLengthError extends Error {}

export class PduFormatError extends Error {}

export interface Pdu {
	type: number
	body: Buffer
}

export interface PresentationContextProposal {
	id: number
	abstractSyntax: string
	transferSyntaxes: string[]
}

export interface AssociateRequest {
	calledAeTitle: string
	callingAeTitle: string
	applicationContext: string
	presentationContexts: PresentationContextProposal[]
	maxPduLength: number | undefined
	implementationClassUid: string | undefined
	implementationVersionName: string | undefined
}

export interface PresentationContextResult {
	id: number
	result: number
	transferSyntax: string
}

export interface AssociateAccept {
	calledAeTitle: string
	callingAeTitle: string
	presentationContexts: PresentationContextResult[]
	maxPduLength: number
	implementationClassUid: string
	implementationVersionName: string | undefined
}

export interface PresentationDataValue {
	contextId: number
	isCommand: boolean
	isLast: boolean
	data: Buffer
}

interface Item {
	type: number
	value: Buffer
}

export class PduReader {
	private pending: Buffer = Buffer.alloc(0)

	constructor(private readonly maxBodyLength: number) {}

	push(chunk: Buffer): Pdu[] {
		this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk])
		const pdus: Pdu[] = []
		while (this.pending.length >= PDU_HEADER_LENGTH) {
			const type = this.pending.readUInt8(0)
			const bodyLength = this.pending.readUInt32BE(2)
			if (bodyLength > this.maxBodyLength) {
				throw new PduLengthError(`PDU type ${type} declares ${bodyLength} bytes, limit is ${this.maxBodyLength}`)
			}
			const end = PDU_HEADER_LENGTH + bodyLength
			if (this.pending.length < end) {
				break
			}
			pdus.push({ type, body: this.pending.subarray(PDU_HEADER_LENGTH, end) })
			this.pending = this.pending.subarray(end)
		}
		return pdus
	}
}

export function encodePdu(type: number, body: Buffer): Buffer {
	const header = Buffer.alloc(PDU_HEADER_LENGTH)
	header.writeUInt8(type, 0)
	header.writeUInt32BE(body.length, 2)
	return Buffer.concat([header, body])
}

function encodeItem(type: number, value: Buffer): Buffer {
	const header = Buffer.alloc(ITEM_HEADER_LENGTH)
	header.writeUInt8(type, 0)
	header.writeUInt16BE(value.length, 2)
	return Buffer.concat([header, value])
}

function readItems(bytes: Buffer): Item[] {
	const items: Item[] = []
	let offset = 0
	while (offset < bytes.length) {
		if (offset + ITEM_HEADER_LENGTH > bytes.length) {
			throw new PduFormatError(`item header at ${offset} runs past ${bytes.length} bytes`)
		}
		const type = bytes.readUInt8(offset)
		const length = bytes.readUInt16BE(offset + 2)
		const end = offset + ITEM_HEADER_LENGTH + length
		if (end > bytes.length) {
			throw new PduFormatError(`item 0x${type.toString(16)} at ${offset} declares ${length} bytes past the end`)
		}
		items.push({ type, value: bytes.subarray(offset + ITEM_HEADER_LENGTH, end) })
		offset = end
	}
	return items
}

function readUid(value: Buffer): string {
	return value.toString("ascii").replace(UID_PADDING, "")
}

function aeTitleField(title: string): Buffer {
	if (title.length === 0 || title.length > AE_TITLE_LENGTH) {
		throw new PduFormatError(`AE title "${title}" must have 1 to ${AE_TITLE_LENGTH} characters`)
	}
	return Buffer.from(title.padEnd(AE_TITLE_LENGTH, " "), "ascii")
}

function readAeTitle(body: Buffer, offset: number): string {
	return body.toString("ascii", offset, offset + AE_TITLE_LENGTH).trim()
}

function associateBody(calledAeTitle: string, callingAeTitle: string, items: readonly Buffer[]): Buffer {
	const fixed = Buffer.alloc(ASSOCIATE_FIXED_LENGTH)
	fixed.writeUInt16BE(PROTOCOL_VERSION, 0)
	aeTitleField(calledAeTitle).copy(fixed, CALLED_AE_TITLE_OFFSET)
	aeTitleField(callingAeTitle).copy(fixed, CALLING_AE_TITLE_OFFSET)
	return Buffer.concat([fixed, ...items])
}

function maximumLengthItem(maxPduLength: number): Buffer {
	const value = Buffer.alloc(MAXIMUM_LENGTH_VALUE_LENGTH)
	value.writeUInt32BE(maxPduLength, 0)
	return encodeItem(ITEM_TYPE.MAXIMUM_LENGTH, value)
}

function userInformationItem(
	maxPduLength: number,
	implementationClassUid: string,
	implementationVersionName: string | undefined,
): Buffer {
	const subItems = [
		maximumLengthItem(maxPduLength),
		encodeItem(ITEM_TYPE.IMPLEMENTATION_CLASS_UID, Buffer.from(implementationClassUid, "ascii")),
	]
	if (implementationVersionName !== undefined) {
		subItems.push(encodeItem(ITEM_TYPE.IMPLEMENTATION_VERSION_NAME, Buffer.from(implementationVersionName, "ascii")))
	}
	return encodeItem(ITEM_TYPE.USER_INFORMATION, Buffer.concat(subItems))
}

function readUserInformation(
	value: Buffer,
): Pick<AssociateRequest, "maxPduLength" | "implementationClassUid" | "implementationVersionName"> {
	let maxPduLength: number | undefined
	let implementationClassUid: string | undefined
	let implementationVersionName: string | undefined
	for (const item of readItems(value)) {
		if (item.type === ITEM_TYPE.MAXIMUM_LENGTH) {
			if (item.value.length !== MAXIMUM_LENGTH_VALUE_LENGTH) {
				throw new PduFormatError(`maximum length item has ${item.value.length} bytes`)
			}
			maxPduLength = item.value.readUInt32BE(0)
		}
		if (item.type === ITEM_TYPE.IMPLEMENTATION_CLASS_UID) {
			implementationClassUid = readUid(item.value)
		}
		if (item.type === ITEM_TYPE.IMPLEMENTATION_VERSION_NAME) {
			implementationVersionName = item.value.toString("ascii").trim()
		}
	}
	return { maxPduLength, implementationClassUid, implementationVersionName }
}

function readAssociateFixed(body: Buffer): { calledAeTitle: string; callingAeTitle: string; items: Item[] } {
	if (body.length < ASSOCIATE_FIXED_LENGTH) {
		throw new PduFormatError(`associate PDU has ${body.length} bytes, needs at least ${ASSOCIATE_FIXED_LENGTH}`)
	}
	return {
		calledAeTitle: readAeTitle(body, CALLED_AE_TITLE_OFFSET),
		callingAeTitle: readAeTitle(body, CALLING_AE_TITLE_OFFSET),
		items: readItems(body.subarray(ASSOCIATE_FIXED_LENGTH)),
	}
}

function readPresentationContextProposal(value: Buffer): PresentationContextProposal {
	if (value.length < PRESENTATION_CONTEXT_FIXED_LENGTH) {
		throw new PduFormatError(`presentation context item has ${value.length} bytes`)
	}
	let abstractSyntax: string | undefined
	const transferSyntaxes: string[] = []
	for (const item of readItems(value.subarray(PRESENTATION_CONTEXT_FIXED_LENGTH))) {
		if (item.type === ITEM_TYPE.ABSTRACT_SYNTAX) {
			abstractSyntax = readUid(item.value)
		}
		if (item.type === ITEM_TYPE.TRANSFER_SYNTAX) {
			transferSyntaxes.push(readUid(item.value))
		}
	}
	if (abstractSyntax === undefined) {
		throw new PduFormatError("presentation context without abstract syntax")
	}
	return { id: value.readUInt8(0), abstractSyntax, transferSyntaxes }
}

export function parseAssociateRequest(body: Buffer): AssociateRequest {
	const fixed = readAssociateFixed(body)
	let applicationContext: string | undefined
	const presentationContexts: PresentationContextProposal[] = []
	let userInformation: ReturnType<typeof readUserInformation> = {
		maxPduLength: undefined,
		implementationClassUid: undefined,
		implementationVersionName: undefined,
	}
	for (const item of fixed.items) {
		if (item.type === ITEM_TYPE.APPLICATION_CONTEXT) {
			applicationContext = readUid(item.value)
		}
		if (item.type === ITEM_TYPE.PRESENTATION_CONTEXT_RQ) {
			presentationContexts.push(readPresentationContextProposal(item.value))
		}
		if (item.type === ITEM_TYPE.USER_INFORMATION) {
			userInformation = readUserInformation(item.value)
		}
	}
	if (applicationContext === undefined) {
		throw new PduFormatError("associate request without application context")
	}
	return {
		calledAeTitle: fixed.calledAeTitle,
		callingAeTitle: fixed.callingAeTitle,
		applicationContext,
		presentationContexts,
		...userInformation,
	}
}

export function encodeAssociateRequest(request: AssociateRequest): Buffer {
	if (request.maxPduLength === undefined || request.implementationClassUid === undefined) {
		throw new PduFormatError("associate request needs a maximum length and an implementation class UID")
	}
	const contexts = request.presentationContexts.map((context) => {
		const fixed = Buffer.alloc(PRESENTATION_CONTEXT_FIXED_LENGTH)
		fixed.writeUInt8(context.id, 0)
		return encodeItem(
			ITEM_TYPE.PRESENTATION_CONTEXT_RQ,
			Buffer.concat([
				fixed,
				encodeItem(ITEM_TYPE.ABSTRACT_SYNTAX, Buffer.from(context.abstractSyntax, "ascii")),
				...context.transferSyntaxes.map((uid) => encodeItem(ITEM_TYPE.TRANSFER_SYNTAX, Buffer.from(uid, "ascii"))),
			]),
		)
	})
	const body = associateBody(request.calledAeTitle, request.callingAeTitle, [
		encodeItem(ITEM_TYPE.APPLICATION_CONTEXT, Buffer.from(request.applicationContext, "ascii")),
		...contexts,
		userInformationItem(request.maxPduLength, request.implementationClassUid, request.implementationVersionName),
	])
	return encodePdu(PDU_TYPE.ASSOCIATE_RQ, body)
}

export function encodeAssociateAccept(accept: AssociateAccept): Buffer {
	const contexts = accept.presentationContexts.map((context) => {
		const fixed = Buffer.alloc(PRESENTATION_CONTEXT_FIXED_LENGTH)
		fixed.writeUInt8(context.id, 0)
		fixed.writeUInt8(context.result, PRESENTATION_CONTEXT_RESULT_OFFSET)
		return encodeItem(
			ITEM_TYPE.PRESENTATION_CONTEXT_AC,
			Buffer.concat([fixed, encodeItem(ITEM_TYPE.TRANSFER_SYNTAX, Buffer.from(context.transferSyntax, "ascii"))]),
		)
	})
	const body = associateBody(accept.calledAeTitle, accept.callingAeTitle, [
		encodeItem(ITEM_TYPE.APPLICATION_CONTEXT, Buffer.from(APPLICATION_CONTEXT_NAME, "ascii")),
		...contexts,
		userInformationItem(accept.maxPduLength, accept.implementationClassUid, accept.implementationVersionName),
	])
	return encodePdu(PDU_TYPE.ASSOCIATE_AC, body)
}

export function parseAssociateAccept(body: Buffer): AssociateAccept {
	const fixed = readAssociateFixed(body)
	const presentationContexts: PresentationContextResult[] = []
	let userInformation: ReturnType<typeof readUserInformation> | undefined
	for (const item of fixed.items) {
		if (item.type === ITEM_TYPE.PRESENTATION_CONTEXT_AC) {
			if (item.value.length < PRESENTATION_CONTEXT_FIXED_LENGTH) {
				throw new PduFormatError(`presentation context item has ${item.value.length} bytes`)
			}
			const transferSyntax = readItems(item.value.subarray(PRESENTATION_CONTEXT_FIXED_LENGTH)).find(
				(subItem) => subItem.type === ITEM_TYPE.TRANSFER_SYNTAX,
			)
			presentationContexts.push({
				id: item.value.readUInt8(0),
				result: item.value.readUInt8(PRESENTATION_CONTEXT_RESULT_OFFSET),
				transferSyntax: transferSyntax === undefined ? "" : readUid(transferSyntax.value),
			})
		}
		if (item.type === ITEM_TYPE.USER_INFORMATION) {
			userInformation = readUserInformation(item.value)
		}
	}
	if (userInformation?.maxPduLength === undefined || userInformation.implementationClassUid === undefined) {
		throw new PduFormatError("associate accept without maximum length or implementation class UID")
	}
	return {
		calledAeTitle: fixed.calledAeTitle,
		callingAeTitle: fixed.callingAeTitle,
		presentationContexts,
		maxPduLength: userInformation.maxPduLength,
		implementationClassUid: userInformation.implementationClassUid,
		implementationVersionName: userInformation.implementationVersionName,
	}
}

export function encodeAssociateReject(result: number, source: number, reason: number): Buffer {
	return encodePdu(PDU_TYPE.ASSOCIATE_RJ, Buffer.from([RESERVED, result, source, reason]))
}

export function encodeAbort(source: number, reason: number): Buffer {
	return encodePdu(PDU_TYPE.ABORT, Buffer.from([RESERVED, RESERVED, source, reason]))
}

export function encodeReleaseRequest(): Buffer {
	return encodePdu(PDU_TYPE.RELEASE_RQ, Buffer.alloc(SHORT_PDU_BODY_LENGTH))
}

export function encodeReleaseResponse(): Buffer {
	return encodePdu(PDU_TYPE.RELEASE_RP, Buffer.alloc(SHORT_PDU_BODY_LENGTH))
}

export function encodeDataPdu(values: readonly PresentationDataValue[]): Buffer {
	const items = values.map((value) => {
		const header = Buffer.alloc(PDV_HEADER_LENGTH)
		header.writeUInt32BE(value.data.length + PDV_HEADER_LENGTH - PDV_LENGTH_FIELD, 0)
		header.writeUInt8(value.contextId, PDV_CONTEXT_OFFSET)
		header.writeUInt8((value.isCommand ? PDV_COMMAND_FLAG : 0) | (value.isLast ? PDV_LAST_FLAG : 0), PDV_CONTROL_OFFSET)
		return Buffer.concat([header, value.data])
	})
	return encodePdu(PDU_TYPE.DATA_TF, Buffer.concat(items))
}

export function parseDataPdu(body: Buffer): PresentationDataValue[] {
	const values: PresentationDataValue[] = []
	let offset = 0
	while (offset < body.length) {
		if (offset + PDV_HEADER_LENGTH > body.length) {
			throw new PduFormatError(`PDV header at ${offset} runs past ${body.length} bytes`)
		}
		const itemLength = body.readUInt32BE(offset)
		const end = offset + PDV_LENGTH_FIELD + itemLength
		if (itemLength < PDV_HEADER_LENGTH - PDV_LENGTH_FIELD || end > body.length) {
			throw new PduFormatError(`PDV at ${offset} declares ${itemLength} bytes, PDU has ${body.length}`)
		}
		const control = body.readUInt8(offset + PDV_CONTROL_OFFSET)
		values.push({
			contextId: body.readUInt8(offset + PDV_CONTEXT_OFFSET),
			isCommand: (control & PDV_COMMAND_FLAG) !== 0,
			isLast: (control & PDV_LAST_FLAG) !== 0,
			data: body.subarray(offset + PDV_HEADER_LENGTH, end),
		})
		offset = end
	}
	return values
}

// PS3.8 D.1
export function fragmentMessage(
	contextId: number,
	isCommand: boolean,
	bytes: Buffer,
	peerMaxPduLength: number,
	ownMaxPduLength: number,
): Buffer[] {
	const maxPduLength = peerMaxPduLength === UNLIMITED_PDU_LENGTH ? ownMaxPduLength : peerMaxPduLength
	const maxFragment = maxPduLength - PDV_HEADER_LENGTH
	if (maxFragment <= 0) {
		throw new PduFormatError(`maximum PDU length ${maxPduLength} leaves no room for data`)
	}
	const pdus: Buffer[] = []
	for (let offset = 0; offset < bytes.length || pdus.length === 0; offset += maxFragment) {
		const end = Math.min(offset + maxFragment, bytes.length)
		pdus.push(
			encodeDataPdu([{ contextId, isCommand, isLast: end === bytes.length, data: bytes.subarray(offset, end) }]),
		)
	}
	return pdus
}
