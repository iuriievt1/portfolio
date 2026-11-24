import {
	COMMAND_FIELD,
	DATA_SET_PRESENT,
	type DimseCommand,
	elementHeader,
	emptyCommand,
	encodeCommand,
	encodeElement,
	encodeSequence,
	nestedSequences,
	STATUS,
	textValue,
	uidValue,
} from "../dimse"
import {
	ASSOCIATE_FIXED_LENGTH,
	type AssociateRequest,
	encodeAssociateReject,
	encodeAssociateRequest,
	encodeDataPdu,
	encodePdu,
	encodeReleaseRequest,
	ITEM_HEADER_LENGTH,
	ITEM_TYPE,
	PDU_HEADER_LENGTH,
	PDU_TYPE,
	SHORT_PDU_BODY_LENGTH,
} from "../pdu"
import {
	ECHO_GOLDEN,
	echoScenario,
	FIND_GOLDEN,
	findScenario,
	REJECTION_GOLDEN,
	rejectScenario,
	STORE_GOLDEN,
	storeScenario,
} from "../suite/status-golden"
import { SYNTHETIC_PATIENT_ID } from "../synthetic"
import { CT_IMAGE_STORAGE, EXPLICIT_VR_BIG_ENDIAN } from "../uids"
import {
	abortPdu,
	acceptedContexts,
	acceptPdu,
	CLOSE,
	type HostileAction,
	type HostileCase,
	HostileCaseError,
	type InboundMessage,
	messagePdus,
	PAUSE,
	type Peer,
	RESET,
	responseCommand,
	responsePdus,
	SILENCE,
	send,
	successCommand,
	successResponse,
} from "./session"

const MAX_DECLARED_LENGTH = 0xff_ff_ff_ff
const OVERSIZED_DATA_LENGTH = 0xff_ff_ff_f0
export const UNDEFINED_PDU_TYPE = 0x0a
const UNPROPOSED_CONTEXT_ID_STEP = 2
const PDU_LENGTH_OFFSET = 2
const ITEM_LENGTH_OFFSET = 2
const MAX_ITEM_LENGTH = 0xff_ff
const MESSAGE_ID_MASK = 0xff_ff
const TRUNCATED_LENGTH_DIVISOR = 2
const FOREIGN_SOP_INSTANCE_UID = "2.25.1"
const FOREIGN_SOP_CLASS_UID = CT_IMAGE_STORAGE
export const NESTING_DEPTH = 10_000
const PENDING_BEFORE_SILENCE = 3
export const PENDING_BEFORE_CANCEL = 300
export const PACKED_PENDING = 70
const PEER_MESSAGE_ID = 1
export const GROUP_LENGTH_VALUE_OFFSET = 8
const LYING_LENGTH_SURPLUS = 1000
const ERROR_COMMENT_TAG = 0x00_00_09_02
const STRAY_DATA_SET_LENGTH = 8
export const OVERSIZED_IDENTIFIER_LENGTH = 2 * 1024 * 1024
const UTF8_CHARACTER_SET = "ISO_IR 192"
const LATIN1_CHARACTER_SET = "ISO_IR 100"
const STUDY_LEVEL = "STUDY"

const TAG = {
	SPECIFIC_CHARACTER_SET: 0x00_08_00_05,
	QUERY_RETRIEVE_LEVEL: 0x00_08_00_52,
	PATIENT_NAME: 0x00_10_00_10,
	PATIENT_ID: 0x00_10_00_20,
	STUDY_INSTANCE_UID: 0x00_20_00_0d,
	SCHEDULED_PROCEDURE_STEP_SEQUENCE: 0x00_40_01_00,
	PROCEDURE_CODE_SEQUENCE: 0x00_08_10_32,
	CODE_VALUE: 0x00_08_01_00,
	CODING_SCHEME_DESIGNATOR: 0x00_08_01_02,
	CODE_MEANING: 0x00_08_01_04,
} as const

export const NESTED_UTF8_PATIENT_NAME = "Šťastná^Jana"
export const LATIN1_PATIENT_NAME = "Nováková^Jana"
export const ASCII_PATIENT_NAME = "NOVAKOVA^JANA"
export const NESTED_UTF8_CODE_MEANING = "Ošetření rány – kontrola"

function withDeclaredLength(pdu: Buffer, length: number): Buffer {
	const copy = Buffer.from(pdu)
	copy.writeUInt32BE(length, PDU_LENGTH_OFFSET)
	return copy
}

function itemOffset(pdu: Buffer, itemType: number): number {
	let offset = PDU_HEADER_LENGTH + ASSOCIATE_FIXED_LENGTH
	while (offset + ITEM_HEADER_LENGTH <= pdu.length) {
		if (pdu.readUInt8(offset) === itemType) {
			return offset
		}
		offset += ITEM_HEADER_LENGTH + pdu.readUInt16BE(offset + ITEM_LENGTH_OFFSET)
	}
	throw new Error(`item 0x${itemType.toString(16)} not found`)
}

function isFind(message: InboundMessage): boolean {
	return message.command.commandField === COMMAND_FIELD.C_FIND_RQ
}

function isCancel(message: InboundMessage): boolean {
	return message.command.commandField === COMMAND_FIELD.C_CANCEL_RQ
}

// PS3.4 C.4.1.3, PS3.7 9.3.2.3
const findsBeingCancelled = new WeakMap<Peer, InboundMessage>()

function cancellableFind(finalStatus: number) {
	return (peer: Peer, message: InboundMessage): HostileAction[] => {
		if (isFind(message)) {
			findsBeingCancelled.set(peer, message)
			return Array.from({ length: PENDING_BEFORE_CANCEL }, (_, index) =>
				send(pendingFind(peer, message, studyIdentifier(`2.25.${index + 1}`))),
			)
		}
		const find = findsBeingCancelled.get(peer)
		if (isCancel(message) && find !== undefined) {
			findsBeingCancelled.delete(peer)
			return [send(responsePdus(peer, find, responseCommand(find, COMMAND_FIELD.C_FIND_RSP, finalStatus)))]
		}
		return successResponse(peer, message)
	}
}

// PS3.8 9.3.5
function packedFind(message: InboundMessage): Buffer {
	const pending = {
		...responseCommand(message, COMMAND_FIELD.C_FIND_RSP, STATUS.PENDING),
		dataSetType: DATA_SET_PRESENT,
	}
	const contextId = message.context.id
	const values = Array.from({ length: PACKED_PENDING }, (_, index) => [
		{ contextId, isCommand: true, isLast: true, data: encodeCommand(pending) },
		{ contextId, isCommand: false, isLast: true, data: studyIdentifier(`2.25.${index + 1}`) },
	]).flat()
	const final = responseCommand(message, COMMAND_FIELD.C_FIND_RSP, STATUS.SUCCESS)
	return encodeDataPdu([...values, { contextId, isCommand: true, isLast: true, data: encodeCommand(final) }])
}

function isStore(message: InboundMessage): boolean {
	return message.command.commandField === COMMAND_FIELD.C_STORE_RQ
}

function pendingFind(peer: Peer, message: InboundMessage, identifier: Buffer, status: number = STATUS.PENDING): Buffer {
	const command = {
		...responseCommand(message, COMMAND_FIELD.C_FIND_RSP, status),
		dataSetType: DATA_SET_PRESENT,
	}
	return Buffer.concat([
		messagePdus(peer, message.context.id, true, encodeCommand(command)),
		messagePdus(peer, message.context.id, false, identifier),
	])
}

function studyIdentifier(studyInstanceUid: string): Buffer {
	return Buffer.concat([
		encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(UTF8_CHARACTER_SET)),
		encodeElement(TAG.QUERY_RETRIEVE_LEVEL, textValue(STUDY_LEVEL)),
		encodeElement(TAG.PATIENT_ID, textValue(SYNTHETIC_PATIENT_ID)),
		encodeElement(TAG.STUDY_INSTANCE_UID, uidValue(studyInstanceUid)),
	])
}

function acceptWith(request: AssociateRequest, edit: (pdu: Buffer) => Buffer): HostileAction[] {
	return [send(edit(acceptPdu(request, acceptedContexts(request)))), SILENCE]
}

function withSuccessCommand(respond: (peer: Peer, message: InboundMessage, command: DimseCommand) => HostileAction[]) {
	return (peer: Peer, message: InboundMessage): HostileAction[] => {
		const command = successCommand(message)
		return command === undefined ? [] : respond(peer, message, command)
	}
}

function isFirstOfSeveralFragments(calledAeTitle: string, message: InboundMessage, isLast: boolean): boolean {
	if (message.datasetFragments !== 1) {
		return false
	}
	if (isLast) {
		throw new HostileCaseError(`${calledAeTitle} needs a data set of at least two P-DATA fragments`)
	}
	return true
}

function onFind(respond: (peer: Peer, message: InboundMessage) => HostileAction[]) {
	return (peer: Peer, message: InboundMessage): HostileAction[] =>
		isFind(message) ? respond(peer, message) : successResponse(peer, message)
}

function onStore(respond: (peer: Peer, message: InboundMessage) => HostileAction[]) {
	return (peer: Peer, message: InboundMessage): HostileAction[] =>
		isStore(message) ? respond(peer, message) : successResponse(peer, message)
}

export const HOSTILE_CASES: readonly HostileCase[] = [
	{ calledAeTitle: "BASELINE", source: "integrace-dicom.md 11.1" },
	{
		calledAeTitle: "AC-OVERSIZE",
		source: "integrace-dicom.md 6.3, 10",
		associate: () => [
			send(withDeclaredLength(encodePdu(PDU_TYPE.ASSOCIATE_AC, Buffer.alloc(0)), MAX_DECLARED_LENGTH)),
			SILENCE,
		],
	},
	{
		calledAeTitle: "AC-TRUNCATED",
		source: "ADR-017, integrace-dicom.md 11",
		associate: (request) => {
			const pdu = acceptPdu(request, acceptedContexts(request))
			return [send(pdu.subarray(0, Math.floor(pdu.length / TRUNCATED_LENGTH_DIVISOR))), CLOSE]
		},
	},
	{
		calledAeTitle: "AC-ITEM-OVERRUN",
		source: "ADR-017, integrace-dicom.md 11",
		associate: (request) =>
			acceptWith(request, (pdu) => {
				const copy = Buffer.from(pdu)
				copy.writeUInt16BE(MAX_ITEM_LENGTH, itemOffset(copy, ITEM_TYPE.PRESENTATION_CONTEXT_AC) + ITEM_LENGTH_OFFSET)
				return copy
			}),
	},
	{
		calledAeTitle: "AC-SECOND",
		source: "PS3.8 9.2.3, ADR-017",
		accepted: (peer) => [send(acceptPdu(peer.request, acceptedContexts(peer.request))), SILENCE],
	},
	{
		calledAeTitle: "AC-UNPROPOSED-ID",
		source: "integrace-dicom.md 3, 8.3",
		associate: (request) => {
			const highestId = Math.max(...request.presentationContexts.map((context) => context.id))
			const contexts = acceptedContexts(request).map((context, index) =>
				index === 0 ? { ...context, id: highestId + UNPROPOSED_CONTEXT_ID_STEP } : context,
			)
			return [send(acceptPdu(request, contexts)), SILENCE]
		},
	},
	{
		calledAeTitle: "AC-UNPROPOSED-TS",
		source: "ADR-005 ř. 23, integrace-dicom.md 3",
		associate: (request) => {
			const contexts = acceptedContexts(request).map((context) => ({
				...context,
				transferSyntax: EXPLICIT_VR_BIG_ENDIAN,
			}))
			return [send(acceptPdu(request, contexts)), SILENCE]
		},
	},
	{
		calledAeTitle: "PDU-UNKNOWN-TYPE",
		source: "ADR-017, integrace-dicom.md 11",
		associate: () => [send(encodePdu(UNDEFINED_PDU_TYPE, Buffer.alloc(SHORT_PDU_BODY_LENGTH))), SILENCE],
	},
	{
		calledAeTitle: "NO-RESPONSE",
		source: "integrace-dicom.md 6.3, 8.3",
		associate: () => [SILENCE],
	},
	{
		calledAeTitle: "RESET-ON-RQ",
		source: "integrace-dicom.md 8.3",
		associate: () => [RESET],
	},
	{
		calledAeTitle: "PDATA-OVERSIZE",
		source: "integrace-dicom.md 6.3, 10",
		respond: () => [
			send(withDeclaredLength(encodePdu(PDU_TYPE.DATA_TF, Buffer.alloc(0)), OVERSIZED_DATA_LENGTH)),
			SILENCE,
		],
	},
	{
		calledAeTitle: "PDV-OVERRUN",
		source: "ADR-017, integrace-dicom.md 11",
		respond: withSuccessCommand((peer, message, command) => {
			const pdu = Buffer.from(responsePdus(peer, message, command))
			pdu.writeUInt32BE(pdu.length, PDU_HEADER_LENGTH)
			return [send(pdu), SILENCE]
		}),
	},
	{
		calledAeTitle: "PDATA-NO-PDV",
		source: "PS3.8 9.3.5, ADR-017",
		respond: () => [send(encodePdu(PDU_TYPE.DATA_TF, Buffer.alloc(0))), SILENCE],
	},
	{
		calledAeTitle: "DATA-BEFORE-CMD",
		source: "PS3.8 E.1, ADR-017",
		respond: withSuccessCommand((peer, message, command) => [
			send(
				Buffer.concat([
					messagePdus(peer, message.context.id, false, Buffer.alloc(STRAY_DATA_SET_LENGTH)),
					messagePdus(peer, message.context.id, true, encodeCommand(command)),
				]),
			),
			SILENCE,
		]),
	},
	{
		calledAeTitle: "PDV-FOREIGN-CTX",
		source: "integrace-dicom.md 8.1",
		respond: withSuccessCommand((peer, _, command) => {
			const foreignContextId = Math.max(...peer.contexts.keys()) + UNPROPOSED_CONTEXT_ID_STEP
			return [send(messagePdus(peer, foreignContextId, true, encodeCommand(command))), SILENCE]
		}),
	},
	{
		calledAeTitle: "RSP-FOREIGN-ID",
		source: "integrace-dicom.md 8.1",
		respond: withSuccessCommand((peer, message, command) => {
			const foreignId = ((message.command.messageId ?? 0) + 1) & MESSAGE_ID_MASK
			return [send(responsePdus(peer, message, { ...command, messageIdBeingRespondedTo: foreignId })), SILENCE]
		}),
	},
	{
		calledAeTitle: "RSP-FOREIGN-UID",
		source: "integrace-dicom.md 8.1",
		respond: onStore((peer, message) => {
			const command = responseCommand(message, COMMAND_FIELD.C_STORE_RSP, STATUS.SUCCESS)
			return [
				send(responsePdus(peer, message, { ...command, affectedSopInstanceUid: FOREIGN_SOP_INSTANCE_UID })),
				SILENCE,
			]
		}),
	},
	{
		calledAeTitle: "RSP-OTHER-CLASS",
		source: "PS3.7 9.1.1.1.3, integrace-dicom.md 8.1",
		respond: onStore((peer, message) => {
			const command = responseCommand(message, COMMAND_FIELD.C_STORE_RSP, STATUS.SUCCESS)
			return [send(responsePdus(peer, message, { ...command, affectedSopClassUid: FOREIGN_SOP_CLASS_UID })), SILENCE]
		}),
	},
	{
		calledAeTitle: "RSP-OTHER-CTX",
		source: "PS3.8 E.1, integrace-dicom.md 8.1",
		respond: withSuccessCommand((peer, message, command) => {
			const otherContextId = [...peer.contexts.keys()].find((id) => id !== message.context.id)
			if (otherContextId === undefined) {
				throw new HostileCaseError("RSP-OTHER-CTX needs a second presentation context")
			}
			return [send(messagePdus(peer, otherContextId, true, encodeCommand(command))), SILENCE]
		}),
	},
	{
		calledAeTitle: "RSP-DUPLICATE",
		source: "PS3.7 9.1.1.1.2, integrace-dicom.md 8.1",
		respond: (peer, message) => [...successResponse(peer, message), ...successResponse(peer, message), SILENCE],
	},
	{
		calledAeTitle: "RSP-NO-STATUS",
		source: "PS3.7 9.3, integrace-dicom.md 8.1",
		respond: withSuccessCommand((peer, message, command) => [
			send(responsePdus(peer, message, { ...command, status: undefined })),
			SILENCE,
		]),
	},
	{
		calledAeTitle: "RSP-ECHO-TYPE",
		source: "integrace-dicom.md 8.1",
		respond: onStore((peer, message) => [
			send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_ECHO_RSP, STATUS.SUCCESS))),
			SILENCE,
		]),
	},
	{
		calledAeTitle: "RSP-FIND-TYPE",
		source: "integrace-dicom.md 8.1",
		respond: onStore((peer, message) => [
			send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_FIND_RSP, STATUS.SUCCESS))),
			SILENCE,
		]),
	},
	{
		calledAeTitle: "RSP-MOVE-TYPE",
		source: "ADR-017",
		respond: (peer, message) => [
			send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_MOVE_RSP, STATUS.SUCCESS))),
			SILENCE,
		],
	},
	{
		calledAeTitle: "PEER-REQUEST",
		source: "ADR-017",
		respond: (peer, message) => {
			const request = {
				...emptyCommand(message.command.commandField),
				messageId: PEER_MESSAGE_ID,
				affectedSopClassUid: message.command.affectedSopClassUid,
			}
			return [send(messagePdus(peer, message.context.id, true, encodeCommand(request))), SILENCE]
		},
	},
	{
		calledAeTitle: "PEER-ASSOC-RQ",
		source: "ADR-017",
		accepted: (peer) => [
			send(
				encodeAssociateRequest({
					...peer.request,
					calledAeTitle: peer.request.callingAeTitle,
					callingAeTitle: peer.request.calledAeTitle,
				}),
			),
			SILENCE,
		],
	},
	{
		calledAeTitle: "RSP-EARLY-OK",
		source: "integrace-dicom.md 8.1",
		datasetFragment: (peer, message, isLast) =>
			isFirstOfSeveralFragments("RSP-EARLY-OK", message, isLast) ? [...successResponse(peer, message), PAUSE] : [],
		respond: onStore(() => []),
	},
	{
		calledAeTitle: "RSP-STORE-FF00",
		source: "integrace-dicom.md 8.1",
		respond: onStore((peer, message) => [
			send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_STORE_RSP, STATUS.PENDING))),
			SILENCE,
		]),
	},
	{
		calledAeTitle: "CMD-GROUP-LENGTH",
		source: "ADR-017, integrace-dicom.md 11",
		respond: withSuccessCommand((peer, message, command) => {
			const bytes = Buffer.from(encodeCommand(command))
			bytes.writeUInt32LE(
				bytes.readUInt32LE(GROUP_LENGTH_VALUE_OFFSET) + LYING_LENGTH_SURPLUS,
				GROUP_LENGTH_VALUE_OFFSET,
			)
			return [send(messagePdus(peer, message.context.id, true, bytes)), SILENCE]
		}),
	},
	{
		calledAeTitle: "CMD-TRUNCATED",
		source: "ADR-017, integrace-dicom.md 11",
		respond: withSuccessCommand((peer, message, command) => {
			const bytes = Buffer.concat([encodeCommand(command), elementHeader(ERROR_COMMENT_TAG, LYING_LENGTH_SURPLUS)])
			return [send(messagePdus(peer, message.context.id, true, bytes)), SILENCE]
		}),
	},
	{
		calledAeTitle: "FIND-HUGE-LENGTH",
		source: "integrace-dicom.md 6.3, ADR-017",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(UTF8_CHARACTER_SET)),
				elementHeader(TAG.PATIENT_NAME, OVERSIZED_DATA_LENGTH),
				Buffer.from("SYNTHETIC", "ascii"),
			])
			return [send(pendingFind(peer, message, identifier)), SILENCE]
		}),
	},
	{
		calledAeTitle: "FIND-DEEP-NEST",
		source: "ADR-017, integrace-dicom.md 11",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(UTF8_CHARACTER_SET)),
				nestedSequences(TAG.SCHEDULED_PROCEDURE_STEP_SEQUENCE, NESTING_DEPTH),
			])
			return [send(pendingFind(peer, message, identifier)), SILENCE]
		}),
	},
	{
		calledAeTitle: "FIND-FLOOD",
		source: "integrace-dicom.md 6.3, 6.4",
		respond: onFind((peer, message) => {
			let sequence = 0
			return [
				{
					kind: "flood",
					next: () => {
						sequence += 1
						return pendingFind(peer, message, studyIdentifier(`2.25.${sequence}`))
					},
				},
			]
		}),
	},
	{
		calledAeTitle: "FIND-OVERSIZE",
		source: "integrace-dicom.md 6.3, ADR-017",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(UTF8_CHARACTER_SET)),
				encodeElement(TAG.PATIENT_NAME, textValue("S".repeat(OVERSIZED_IDENTIFIER_LENGTH))),
			])
			return [send(pendingFind(peer, message, identifier)), SILENCE]
		}),
	},
	{
		calledAeTitle: "FIND-NESTED-UTF8",
		source: "PS3.5 7.5.3, Q-035, integrace-dicom.md 5.7",
		respond: onFind((peer, message) => {
			const procedureCode = Buffer.concat([
				encodeElement(TAG.CODE_VALUE, textValue("XR")),
				encodeElement(TAG.CODING_SCHEME_DESIGNATOR, textValue("99VULNA")),
				encodeElement(TAG.CODE_MEANING, textValue(NESTED_UTF8_CODE_MEANING)),
			])
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(UTF8_CHARACTER_SET)),
				encodeElement(TAG.QUERY_RETRIEVE_LEVEL, textValue(STUDY_LEVEL)),
				encodeSequence(TAG.PROCEDURE_CODE_SEQUENCE, [procedureCode]),
				encodeElement(TAG.PATIENT_NAME, textValue(NESTED_UTF8_PATIENT_NAME)),
				encodeElement(TAG.PATIENT_ID, textValue(SYNTHETIC_PATIENT_ID)),
				encodeElement(TAG.STUDY_INSTANCE_UID, uidValue("2.25.508")),
			])
			return [send(pendingFind(peer, message, identifier)), ...successResponse(peer, message)]
		}),
	},
	{
		calledAeTitle: "FIND-LATIN1",
		source: "PS3.5 6.1.2.3, integrace-dicom.md 6.4, 10",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, textValue(LATIN1_CHARACTER_SET)),
				encodeElement(TAG.QUERY_RETRIEVE_LEVEL, textValue(STUDY_LEVEL)),
				encodeElement(TAG.PATIENT_NAME, textValue(LATIN1_PATIENT_NAME, "latin1")),
				encodeElement(TAG.PATIENT_ID, textValue(SYNTHETIC_PATIENT_ID)),
				encodeElement(TAG.STUDY_INSTANCE_UID, uidValue("2.25.100")),
			])
			return [send(pendingFind(peer, message, identifier)), ...successResponse(peer, message)]
		}),
	},
	{
		calledAeTitle: "FIND-NO-CHARSET",
		source: "CAP-024-R11, integrace-dicom.md 6.4, 10",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.QUERY_RETRIEVE_LEVEL, textValue(STUDY_LEVEL)),
				encodeElement(TAG.PATIENT_NAME, textValue(ASCII_PATIENT_NAME)),
				encodeElement(TAG.PATIENT_ID, textValue(SYNTHETIC_PATIENT_ID)),
				encodeElement(TAG.STUDY_INSTANCE_UID, uidValue("2.25.6")),
			])
			return [send(pendingFind(peer, message, identifier)), ...successResponse(peer, message)]
		}),
	},
	{
		calledAeTitle: "FIND-CANCEL",
		source: "PS3.4 C.4.1.3, integrace-dicom.md 6.3, 8.2",
		respond: cancellableFind(STATUS.CANCEL),
	},
	{
		calledAeTitle: "FIND-CANCEL-OK",
		source: "integrace-dicom.md 6.4, ADR-005 ř. 39",
		respond: cancellableFind(STATUS.SUCCESS),
	},
	{
		calledAeTitle: "FIND-PACKED",
		source: "PS3.8 9.3.5, integrace-dicom.md 6.3",
		respond: onFind((_, message) => [send(packedFind(message))]),
	},
	{
		calledAeTitle: "FIND-EMPTY-SCS",
		source: "PS3.5 6.1.2.3, CAP-024-R11, integrace-dicom.md 6.4",
		respond: onFind((peer, message) => {
			const identifier = Buffer.concat([
				encodeElement(TAG.SPECIFIC_CHARACTER_SET, Buffer.alloc(0)),
				encodeElement(TAG.QUERY_RETRIEVE_LEVEL, textValue(STUDY_LEVEL)),
				encodeElement(TAG.PATIENT_NAME, textValue(ASCII_PATIENT_NAME)),
				encodeElement(TAG.PATIENT_ID, textValue(SYNTHETIC_PATIENT_ID)),
				encodeElement(TAG.STUDY_INSTANCE_UID, uidValue("2.25.7")),
			])
			return [send(pendingFind(peer, message, identifier)), ...successResponse(peer, message)]
		}),
	},
	{
		calledAeTitle: "FIND-FF01",
		source: "PS3.4 C.4.1.1.4, integrace-dicom.md 8.2",
		respond: onFind((peer, message) => [
			send(pendingFind(peer, message, studyIdentifier("2.25.11"), STATUS.PENDING_WARNING)),
			...successResponse(peer, message),
		]),
	},
	{
		calledAeTitle: "FIND-FINAL-DATA",
		source: "PS3.7 9.1.2.1.5, integrace-dicom.md 8.2",
		respond: onFind((peer, message) => {
			const command = {
				...responseCommand(message, COMMAND_FIELD.C_FIND_RSP, STATUS.SUCCESS),
				dataSetType: DATA_SET_PRESENT,
			}
			return [
				send(
					Buffer.concat([
						messagePdus(peer, message.context.id, true, encodeCommand(command)),
						messagePdus(peer, message.context.id, false, studyIdentifier("2.25.12")),
					]),
				),
				SILENCE,
			]
		}),
	},
	{
		calledAeTitle: "FIND-NO-FINAL",
		source: "integrace-dicom.md 8.2",
		respond: onFind((peer, message) => [
			...Array.from({ length: PENDING_BEFORE_SILENCE }, (_, index) =>
				send(pendingFind(peer, message, studyIdentifier(`2.25.${index + 1}`))),
			),
			SILENCE,
		]),
	},
	{ calledAeTitle: "FIN-AFTER-DATA", source: "integrace-dicom.md 8.3", respond: () => [CLOSE] },
	{ calledAeTitle: "RESET-AFTER-DATA", source: "integrace-dicom.md 8.3", respond: () => [RESET] },
	{
		calledAeTitle: "ABORT-MID-DATA",
		source: "integrace-dicom.md 6.2, 8.3",
		datasetFragment: (_, message, isLast) =>
			isFirstOfSeveralFragments("ABORT-MID-DATA", message, isLast) ? [send(abortPdu()), CLOSE] : [],
	},
	{ calledAeTitle: "ABORT-AFTER-DATA", source: "integrace-dicom.md 8.3", respond: () => [send(abortPdu()), CLOSE] },
	{ calledAeTitle: "MUTE-AFTER-DATA", source: "integrace-dicom.md 6.3, 8.3", respond: () => [SILENCE] },
	{ calledAeTitle: "STALL-READ", source: "integrace-dicom.md 6.3", accepted: () => [PAUSE] },
	{ calledAeTitle: "ABORT-ON-RELEASE", source: "integrace-dicom.md 6.2", release: () => [send(abortPdu()), CLOSE] },
	{
		calledAeTitle: "PEER-RELEASE",
		source: "PS3.8 9.2.3, integrace-dicom.md 6.2",
		respond: (peer, message) => [...successResponse(peer, message), send(encodeReleaseRequest())],
	},
	...STORE_GOLDEN.map(
		({ status }): HostileCase => ({
			calledAeTitle: storeScenario(status),
			source: "integrace-dicom.md 8.1, 11",
			respond: onStore((peer, message) => [
				send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_STORE_RSP, status))),
			]),
		}),
	),
	...ECHO_GOLDEN.map(
		({ status }): HostileCase => ({
			calledAeTitle: echoScenario(status),
			source: "integrace-dicom.md 8.3, 11",
			respond: (peer, message) => [
				send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_ECHO_RSP, status))),
			],
		}),
	),
	...FIND_GOLDEN.map(
		({ status }): HostileCase => ({
			calledAeTitle: findScenario(status),
			source: "integrace-dicom.md 8.2, 11",
			respond: onFind((peer, message) => [
				send(pendingFind(peer, message, studyIdentifier("2.25.82"))),
				send(responsePdus(peer, message, responseCommand(message, COMMAND_FIELD.C_FIND_RSP, status))),
			]),
		}),
	),
	...REJECTION_GOLDEN.map(
		(rejection): HostileCase => ({
			calledAeTitle: rejectScenario(rejection),
			source: "integrace-dicom.md 8.3, PS3.8 9.3.4",
			associate: () => [send(encodeAssociateReject(rejection.result, rejection.source, rejection.reason)), CLOSE],
		}),
	),
]
