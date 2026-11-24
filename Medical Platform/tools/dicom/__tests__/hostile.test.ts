import { describe, expect, it } from "vitest"
import {
	COMMAND_FIELD,
	DATA_SET_ABSENT,
	DATA_SET_PRESENT,
	DimseFormatError,
	decodeCommand,
	emptyCommand,
	encodeCommand,
	STATUS,
} from "../dimse"
import {
	ASCII_PATIENT_NAME,
	GROUP_LENGTH_VALUE_OFFSET,
	HOSTILE_CASES,
	LATIN1_PATIENT_NAME,
	NESTED_UTF8_CODE_MEANING,
	NESTED_UTF8_PATIENT_NAME,
	NESTING_DEPTH,
	OVERSIZED_IDENTIFIER_LENGTH,
	PACKED_PENDING,
	PENDING_BEFORE_CANCEL,
	UNDEFINED_PDU_TYPE,
} from "../hostile/cases"
import { hostileCases } from "../hostile/server"
import { acceptedContexts, type HostileAction, HostileSession } from "../hostile/session"
import {
	AE_TITLE_LENGTH,
	encodeAssociateRequest,
	encodeDataPdu,
	encodeReleaseRequest,
	encodeReleaseResponse,
	PDU_HEADER_LENGTH,
	PDU_TYPE,
	type Pdu,
	PduFormatError,
	PduReader,
	PRESENTATION_CONTEXT_RESULT,
	PROFILE_MAX_PDU_LENGTH,
	type PresentationContextProposal,
	parseAssociateAccept,
	parseAssociateRequest,
	parseDataPdu,
	REJECT_FIELD,
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
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import {
	APPLICATION_CONTEXT_NAME,
	EXPLICIT_VR_BIG_ENDIAN,
	EXPLICIT_VR_LITTLE_ENDIAN,
	IMPLICIT_VR_LITTLE_ENDIAN,
	JPEG_BASELINE,
	STUDY_ROOT_FIND,
	VERIFICATION,
	VL_PHOTOGRAPHIC_IMAGE_STORAGE,
} from "../uids"

const ECHO_CONTEXT = 1
const STORE_CONTEXT = 3
const FIND_CONTEXT = 5
const MESSAGE_ID = 7
const SOP_INSTANCE_UID = "2.25.42"
const GROUP_LENGTH_ELEMENT_LENGTH = 12
// PS3.5 7.5
const NESTED_LEVEL_BYTES = 32

function associateRequest(calledAeTitle: string): Buffer {
	return encodeAssociateRequest({
		calledAeTitle,
		callingAeTitle: CALLING_AE_TITLE,
		applicationContext: APPLICATION_CONTEXT_NAME,
		presentationContexts: [
			{ id: ECHO_CONTEXT, abstractSyntax: VERIFICATION, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
			{ id: STORE_CONTEXT, abstractSyntax: VL_PHOTOGRAPHIC_IMAGE_STORAGE, transferSyntaxes: [JPEG_BASELINE] },
			{ id: FIND_CONTEXT, abstractSyntax: STUDY_ROOT_FIND, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
		],
		maxPduLength: PROFILE_MAX_PDU_LENGTH,
		implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
		implementationVersionName: undefined,
	})
}

function commandPdu(contextId: number, commandField: number, affectedSopClassUid: string, dataSetType: number): Buffer {
	const command = {
		...emptyCommand(commandField),
		messageId: MESSAGE_ID,
		affectedSopClassUid,
		affectedSopInstanceUid: commandField === COMMAND_FIELD.C_STORE_RQ ? SOP_INSTANCE_UID : undefined,
		dataSetType,
	}
	return encodeDataPdu([{ contextId, isCommand: true, isLast: true, data: encodeCommand(command) }])
}

function datasetPdu(contextId: number, isLast: boolean): Buffer {
	return encodeDataPdu([{ contextId, isCommand: false, isLast, data: Buffer.alloc(100, 0xab) }])
}

const ECHO = commandPdu(ECHO_CONTEXT, COMMAND_FIELD.C_ECHO_RQ, VERIFICATION, DATA_SET_ABSENT)
const STORE_COMMAND = commandPdu(
	STORE_CONTEXT,
	COMMAND_FIELD.C_STORE_RQ,
	VL_PHOTOGRAPHIC_IMAGE_STORAGE,
	DATA_SET_PRESENT,
)
const STORE_FIRST = datasetPdu(STORE_CONTEXT, false)
const STORE_MIDDLE = datasetPdu(STORE_CONTEXT, false)
const STORE_LAST = datasetPdu(STORE_CONTEXT, true)
const FIND = Buffer.concat([
	commandPdu(FIND_CONTEXT, COMMAND_FIELD.C_FIND_RQ, STUDY_ROOT_FIND, DATA_SET_PRESENT),
	datasetPdu(FIND_CONTEXT, true),
])

const CANCEL = encodeDataPdu([
	{
		contextId: FIND_CONTEXT,
		isCommand: true,
		isLast: true,
		data: encodeCommand({
			...emptyCommand(COMMAND_FIELD.C_CANCEL_RQ),
			messageIdBeingRespondedTo: MESSAGE_ID,
		}),
	},
])

function sentBytes(actions: readonly HostileAction[]): Buffer {
	return Buffer.concat(actions.flatMap((action) => (action.kind === "send" ? [action.bytes] : [])))
}

function kinds(actions: readonly HostileAction[]): string[] {
	return actions.map((action) => action.kind)
}

function pdusOf(bytes: Buffer): Pdu[] {
	return new PduReader(Number.MAX_SAFE_INTEGER).push(bytes)
}

function responseCommandOf(bytes: Buffer) {
	const values = pdusOf(bytes)
		.filter((pdu) => pdu.type === PDU_TYPE.DATA_TF)
		.flatMap((pdu) => parseDataPdu(pdu.body))
		.filter((value) => value.isCommand)
	return decodeCommand(Buffer.concat(values.map((value) => value.data)))
}

function valuesOf(actions: readonly HostileAction[]) {
	return pdusOf(sentBytes(actions)).flatMap((pdu) => parseDataPdu(pdu.body))
}

function commandsOf(actions: readonly HostileAction[]) {
	return valuesOf(actions)
		.filter((value) => value.isCommand)
		.map((value) => decodeCommand(value.data))
}

function identifierOf(actions: readonly HostileAction[]): Buffer {
	return Buffer.concat(
		valuesOf(actions)
			.filter((value) => !value.isCommand)
			.map((value) => value.data),
	)
}

function associated(calledAeTitle: string) {
	const session = new HostileSession(hostileCases())
	const accept = session.receive(associateRequest(calledAeTitle))
	return { session, accept }
}

function store(session: HostileSession) {
	return {
		command: session.receive(STORE_COMMAND),
		first: session.receive(STORE_FIRST),
		middle: session.receive(STORE_MIDDLE),
		last: session.receive(STORE_LAST),
	}
}

const tested = new Set<string>()

function hostile(calledAeTitle: string, check: () => void) {
	tested.add(calledAeTitle)
	it(calledAeTitle, check)
}

describe("hostile SCP ADR-017, integrace-dicom.md 11", () => {
	it("every case has a unique called AE title of at most 16 characters and a source in the spec", () => {
		const titles = HOSTILE_CASES.map((hostileCase) => hostileCase.calledAeTitle)

		expect(new Set(titles).size).toBe(titles.length)
		expect(titles.every((title) => title.length <= AE_TITLE_LENGTH)).toBe(true)
		expect(HOSTILE_CASES.every((hostileCase) => hostileCase.source.length > 0)).toBe(true)
	})

	it("rejects an unknown called AE title permanently, called AE title not recognized", () => {
		const actions = new HostileSession(hostileCases()).receive(associateRequest("NO-SUCH-CASE"))

		expect([...sentBytes(actions)]).toEqual([PDU_TYPE.ASSOCIATE_RJ, 0, 0, 0, 0, 4, 0, 1, 1, 7])
		expect(kinds(actions)).toEqual(["send", "close"])
	})

	it("aborts before buffering a client PDU over its read limit", () => {
		const header = Buffer.from([PDU_TYPE.DATA_TF, 0, 0xff, 0xff, 0xff, 0xff])
		const { session } = associated("BASELINE")

		expect(kinds(session.receive(header))).toEqual(["send", "close"])
		expect(session.failure).toContain("declares")
	})

	hostile("BASELINE", () => {
		const { session, accept } = associated("BASELINE")
		const [acceptPdu] = pdusOf(sentBytes(accept))
		const parsed = parseAssociateAccept(acceptPdu?.body ?? Buffer.alloc(0))
		expect(parsed.presentationContexts.map((context) => [context.id, context.result, context.transferSyntax])).toEqual([
			[ECHO_CONTEXT, PRESENTATION_CONTEXT_RESULT.ACCEPTANCE, IMPLICIT_VR_LITTLE_ENDIAN],
			[STORE_CONTEXT, PRESENTATION_CONTEXT_RESULT.ACCEPTANCE, JPEG_BASELINE],
			[FIND_CONTEXT, PRESENTATION_CONTEXT_RESULT.ACCEPTANCE, IMPLICIT_VR_LITTLE_ENDIAN],
		])

		const echo = responseCommandOf(sentBytes(session.receive(ECHO)))
		expect([echo.commandField, echo.messageIdBeingRespondedTo, echo.status]).toEqual([
			COMMAND_FIELD.C_ECHO_RSP,
			MESSAGE_ID,
			STATUS.SUCCESS,
		])

		const stored = store(session)
		expect([stored.command, stored.first, stored.middle]).toEqual([[], [], []])
		const storeResponse = responseCommandOf(sentBytes(stored.last))
		expect([storeResponse.commandField, storeResponse.affectedSopInstanceUid, storeResponse.status]).toEqual([
			COMMAND_FIELD.C_STORE_RSP,
			SOP_INSTANCE_UID,
			STATUS.SUCCESS,
		])

		const release = session.receive(encodeReleaseRequest())
		expect(pdusOf(sentBytes(release)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.RELEASE_RP])
		expect(kinds(release)).toEqual(["send", "close"])
	})

	hostile("AC-OVERSIZE", () => {
		const { accept } = associated("AC-OVERSIZE")
		const bytes = sentBytes(accept)

		expect([bytes.length, bytes.readUInt8(0), bytes.readUInt32BE(2)]).toEqual([
			PDU_HEADER_LENGTH,
			PDU_TYPE.ASSOCIATE_AC,
			0xff_ff_ff_ff,
		])
		expect(kinds(accept)).toEqual(["send", "silence"])
	})

	hostile("AC-TRUNCATED", () => {
		const { accept } = associated("AC-TRUNCATED")
		const bytes = sentBytes(accept)

		expect(bytes.length).toBeLessThan(bytes.readUInt32BE(2) + PDU_HEADER_LENGTH)
		expect(kinds(accept)).toEqual(["send", "close"])
	})

	hostile("AC-ITEM-OVERRUN", () => {
		const [pdu] = pdusOf(sentBytes(associated("AC-ITEM-OVERRUN").accept))

		expect(() => parseAssociateAccept(pdu?.body ?? Buffer.alloc(0))).toThrow(PduFormatError)
	})

	hostile("AC-SECOND", () => {
		const { accept } = associated("AC-SECOND")

		expect(pdusOf(sentBytes(accept)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.ASSOCIATE_AC, PDU_TYPE.ASSOCIATE_AC])
		expect(kinds(accept)).toEqual(["send", "send", "silence"])
	})

	hostile("AC-UNPROPOSED-ID", () => {
		const [pdu] = pdusOf(sentBytes(associated("AC-UNPROPOSED-ID").accept))
		const ids = parseAssociateAccept(pdu?.body ?? Buffer.alloc(0)).presentationContexts.map((context) => context.id)

		expect(ids.some((id) => ![ECHO_CONTEXT, STORE_CONTEXT, FIND_CONTEXT].includes(id))).toBe(true)
	})

	hostile("AC-UNPROPOSED-TS", () => {
		const [pdu] = pdusOf(sentBytes(associated("AC-UNPROPOSED-TS").accept))
		const syntaxes = parseAssociateAccept(pdu?.body ?? Buffer.alloc(0)).presentationContexts.map(
			(context) => context.transferSyntax,
		)

		expect(syntaxes).toEqual([EXPLICIT_VR_BIG_ENDIAN, EXPLICIT_VR_BIG_ENDIAN, EXPLICIT_VR_BIG_ENDIAN])
	})

	hostile("PDU-UNKNOWN-TYPE", () => {
		expect(pdusOf(sentBytes(associated("PDU-UNKNOWN-TYPE").accept)).map((pdu) => pdu.type)).toEqual([
			UNDEFINED_PDU_TYPE,
		])
	})

	hostile("NO-RESPONSE", () => {
		expect(kinds(associated("NO-RESPONSE").accept)).toEqual(["silence"])
	})

	hostile("RESET-ON-RQ", () => {
		expect(kinds(associated("RESET-ON-RQ").accept)).toEqual(["reset"])
	})

	hostile("PDATA-OVERSIZE", () => {
		const bytes = sentBytes(associated("PDATA-OVERSIZE").session.receive(ECHO))

		expect([bytes.length, bytes.readUInt8(0), bytes.readUInt32BE(2)]).toEqual([
			PDU_HEADER_LENGTH,
			PDU_TYPE.DATA_TF,
			0xff_ff_ff_f0,
		])
	})

	hostile("PDV-OVERRUN", () => {
		const [pdu] = pdusOf(sentBytes(associated("PDV-OVERRUN").session.receive(ECHO)))

		expect(() => parseDataPdu(pdu?.body ?? Buffer.alloc(0))).toThrow(PduFormatError)
	})

	hostile("PDV-FOREIGN-CTX", () => {
		const [pdu] = pdusOf(sentBytes(associated("PDV-FOREIGN-CTX").session.receive(ECHO)))
		const [value] = parseDataPdu(pdu?.body ?? Buffer.alloc(0))

		expect([ECHO_CONTEXT, STORE_CONTEXT, FIND_CONTEXT]).not.toContain(value?.contextId)
	})

	hostile("RSP-FOREIGN-ID", () => {
		const response = responseCommandOf(sentBytes(associated("RSP-FOREIGN-ID").session.receive(ECHO)))

		expect([response.commandField, response.messageIdBeingRespondedTo]).toEqual([
			COMMAND_FIELD.C_ECHO_RSP,
			MESSAGE_ID + 1,
		])
	})

	hostile("RSP-FOREIGN-UID", () => {
		const response = responseCommandOf(sentBytes(store(associated("RSP-FOREIGN-UID").session).last))

		expect(response.affectedSopInstanceUid).not.toBe(SOP_INSTANCE_UID)
		expect(response.status).toBe(STATUS.SUCCESS)
	})

	hostile("RSP-ECHO-TYPE", () => {
		const response = responseCommandOf(sentBytes(store(associated("RSP-ECHO-TYPE").session).last))

		expect([response.commandField, response.messageIdBeingRespondedTo]).toEqual([COMMAND_FIELD.C_ECHO_RSP, MESSAGE_ID])
	})

	hostile("RSP-FIND-TYPE", () => {
		const response = responseCommandOf(sentBytes(store(associated("RSP-FIND-TYPE").session).last))

		expect([response.commandField, response.status]).toEqual([COMMAND_FIELD.C_FIND_RSP, STATUS.SUCCESS])
	})

	hostile("RSP-MOVE-TYPE", () => {
		const response = responseCommandOf(sentBytes(associated("RSP-MOVE-TYPE").session.receive(ECHO)))

		expect([response.commandField, response.messageIdBeingRespondedTo]).toEqual([COMMAND_FIELD.C_MOVE_RSP, MESSAGE_ID])
	})

	hostile("PEER-REQUEST", () => {
		const request = responseCommandOf(sentBytes(associated("PEER-REQUEST").session.receive(ECHO)))

		expect([request.commandField, request.messageIdBeingRespondedTo, request.affectedSopClassUid]).toEqual([
			COMMAND_FIELD.C_ECHO_RQ,
			undefined,
			VERIFICATION,
		])
	})

	hostile("PEER-ASSOC-RQ", () => {
		const pdus = pdusOf(sentBytes(associated("PEER-ASSOC-RQ").accept))
		const request = parseAssociateRequest(pdus[1]?.body ?? Buffer.alloc(0))

		expect(pdus.map((pdu) => pdu.type)).toEqual([PDU_TYPE.ASSOCIATE_AC, PDU_TYPE.ASSOCIATE_RQ])
		expect([request.calledAeTitle, request.callingAeTitle]).toEqual([CALLING_AE_TITLE, "PEER-ASSOC-RQ"])
	})

	hostile("RSP-EARLY-OK", () => {
		const stored = store(associated("RSP-EARLY-OK").session)

		expect(responseCommandOf(sentBytes(stored.first)).status).toBe(STATUS.SUCCESS)
		expect(kinds(stored.first)).toEqual(["send", "pause"])
		expect([stored.middle, stored.last]).toEqual([[], []])
	})

	hostile("RSP-OTHER-CLASS", () => {
		const stored = store(associated("RSP-OTHER-CLASS").session)
		const response = responseCommandOf(sentBytes(stored.last))

		expect([response.commandField, response.status]).toEqual([COMMAND_FIELD.C_STORE_RSP, STATUS.SUCCESS])
		expect(response.affectedSopClassUid).toBeDefined()
		expect(response.affectedSopClassUid).not.toBe(VL_PHOTOGRAPHIC_IMAGE_STORAGE)
	})

	hostile("RSP-OTHER-CTX", () => {
		const [value] = valuesOf(associated("RSP-OTHER-CTX").session.receive(ECHO))

		expect(value?.contextId).not.toBe(ECHO_CONTEXT)
		expect(decodeCommand(value?.data ?? Buffer.alloc(0)).commandField).toBe(COMMAND_FIELD.C_ECHO_RSP)
	})

	hostile("RSP-DUPLICATE", () => {
		const commands = commandsOf(associated("RSP-DUPLICATE").session.receive(ECHO))

		expect(commands.map((command) => [command.messageIdBeingRespondedTo, command.status])).toEqual([
			[MESSAGE_ID, STATUS.SUCCESS],
			[MESSAGE_ID, STATUS.SUCCESS],
		])
	})

	hostile("RSP-NO-STATUS", () => {
		const response = responseCommandOf(sentBytes(associated("RSP-NO-STATUS").session.receive(ECHO)))

		expect([response.commandField, response.status]).toEqual([COMMAND_FIELD.C_ECHO_RSP, undefined])
	})

	hostile("RSP-STORE-FF00", () => {
		const stored = store(associated("RSP-STORE-FF00").session)

		expect(responseCommandOf(sentBytes(stored.last)).status).toBe(STATUS.PENDING)
		expect(kinds(stored.last)).toEqual(["send", "silence"])
	})

	hostile("CMD-GROUP-LENGTH", () => {
		const [value] = valuesOf(associated("CMD-GROUP-LENGTH").session.receive(ECHO))
		const command = value?.data ?? Buffer.alloc(0)

		expect(command.readUInt32LE(GROUP_LENGTH_VALUE_OFFSET)).toBeGreaterThan(
			command.length - GROUP_LENGTH_ELEMENT_LENGTH,
		)
	})

	hostile("CMD-TRUNCATED", () => {
		const bytes = sentBytes(associated("CMD-TRUNCATED").session.receive(ECHO))

		expect(() => responseCommandOf(bytes)).toThrow(DimseFormatError)
	})

	hostile("FIND-HUGE-LENGTH", () => {
		const bytes = sentBytes(associated("FIND-HUGE-LENGTH").session.receive(FIND))
		const header = Buffer.from([0x10, 0x00, 0x10, 0x00, 0xf0, 0xff, 0xff, 0xff])

		expect(responseCommandOf(bytes).status).toBe(STATUS.PENDING)
		expect(bytes.includes(header)).toBe(true)
	})

	hostile("FIND-DEEP-NEST", () => {
		const bytes = sentBytes(associated("FIND-DEEP-NEST").session.receive(FIND))

		expect(responseCommandOf(bytes).status).toBe(STATUS.PENDING)
		expect(bytes.length).toBeGreaterThan(NESTING_DEPTH * NESTED_LEVEL_BYTES)
	})

	hostile("FIND-FLOOD", () => {
		const [action] = associated("FIND-FLOOD").session.receive(FIND)
		if (action?.kind !== "flood") {
			throw new Error("expected a flood")
		}
		const first = action.next()
		const second = action.next()

		expect(responseCommandOf(first).status).toBe(STATUS.PENDING)
		expect(first.equals(second)).toBe(false)
	})

	hostile("FIND-NO-FINAL", () => {
		const actions = associated("FIND-NO-FINAL").session.receive(FIND)

		expect(kinds(actions)).toEqual(["send", "send", "send", "silence"])
	})

	hostile("FIN-AFTER-DATA", () => {
		expect(kinds(store(associated("FIN-AFTER-DATA").session).last)).toEqual(["close"])
	})

	hostile("RESET-AFTER-DATA", () => {
		expect(kinds(store(associated("RESET-AFTER-DATA").session).last)).toEqual(["reset"])
	})

	hostile("ABORT-MID-DATA", () => {
		const stored = store(associated("ABORT-MID-DATA").session)

		expect(pdusOf(sentBytes(stored.first)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.ABORT])
		expect([stored.middle, stored.last]).toEqual([[], []])
	})

	hostile("ABORT-AFTER-DATA", () => {
		const stored = store(associated("ABORT-AFTER-DATA").session)

		expect(pdusOf(sentBytes(stored.last)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.ABORT])
		expect(kinds(stored.last)).toEqual(["send", "close"])
	})

	hostile("MUTE-AFTER-DATA", () => {
		expect(kinds(store(associated("MUTE-AFTER-DATA").session).last)).toEqual(["silence"])
	})

	hostile("STALL-READ", () => {
		expect(kinds(associated("STALL-READ").accept)).toEqual(["send", "pause"])
	})

	hostile("ABORT-ON-RELEASE", () => {
		const release = associated("ABORT-ON-RELEASE").session.receive(encodeReleaseRequest())

		expect(pdusOf(sentBytes(release)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.ABORT])
	})

	hostile("PDATA-NO-PDV", () => {
		const response = associated("PDATA-NO-PDV").session.receive(ECHO)
		const pdus = pdusOf(sentBytes(response))

		expect(pdus.map((pdu) => [pdu.type, pdu.body.length])).toEqual([[PDU_TYPE.DATA_TF, 0]])
		expect(kinds(response)).toEqual(["send", "silence"])
	})

	hostile("DATA-BEFORE-CMD", () => {
		const response = associated("DATA-BEFORE-CMD").session.receive(ECHO)
		const values = valuesOf(response)

		expect(values.map((value) => [value.contextId, value.isCommand, value.isLast])).toEqual([
			[ECHO_CONTEXT, false, true],
			[ECHO_CONTEXT, true, true],
		])
		expect(responseCommandOf(sentBytes(response)).status).toBe(STATUS.SUCCESS)
	})

	hostile("FIND-FF01", () => {
		const statuses = commandsOf(associated("FIND-FF01").session.receive(FIND)).map((command) => command.status)

		expect(statuses).toEqual([STATUS.PENDING_WARNING, STATUS.SUCCESS])
	})

	hostile("FIND-FINAL-DATA", () => {
		const values = valuesOf(associated("FIND-FINAL-DATA").session.receive(FIND))
		const command = decodeCommand(values.find((value) => value.isCommand)?.data ?? Buffer.alloc(0))

		expect([command.status, command.dataSetType]).toEqual([STATUS.SUCCESS, DATA_SET_PRESENT])
		expect(values.some((value) => !value.isCommand)).toBe(true)
	})

	hostile("FIND-NESTED-UTF8", () => {
		const actions = associated("FIND-NESTED-UTF8").session.receive(FIND)
		const identifier = identifierOf(actions)
		const commands = commandsOf(actions)

		expect(identifier.includes(Buffer.from(NESTED_UTF8_CODE_MEANING, "utf8"))).toBe(true)
		expect(identifier.includes(Buffer.from(NESTED_UTF8_PATIENT_NAME, "utf8"))).toBe(true)
		expect(commands.map((command) => command.status)).toEqual([STATUS.PENDING, STATUS.SUCCESS])
	})

	hostile("FIND-CANCEL", () => {
		const { session } = associated("FIND-CANCEL")
		const pending = commandsOf(session.receive(FIND))
		const cancelled = commandsOf(session.receive(CANCEL))

		expect(pending).toHaveLength(PENDING_BEFORE_CANCEL)
		expect(pending.every((command) => command.status === STATUS.PENDING)).toBe(true)
		expect(cancelled.map((command) => [command.status, command.messageIdBeingRespondedTo])).toEqual([
			[STATUS.CANCEL, MESSAGE_ID],
		])
		expect(cancelled[0]?.affectedSopClassUid).toBe(STUDY_ROOT_FIND)
	})

	hostile("FIND-CANCEL-OK", () => {
		const { session } = associated("FIND-CANCEL-OK")
		session.receive(FIND)
		const cancelled = commandsOf(session.receive(CANCEL))

		expect(cancelled.map((command) => command.status)).toEqual([STATUS.SUCCESS])
	})

	hostile("FIND-PACKED", () => {
		const { session } = associated("FIND-PACKED")
		const actions = session.receive(FIND)
		const statuses = commandsOf(actions).map((command) => command.status)

		expect(pdusOf(sentBytes(actions))).toHaveLength(1)
		expect(statuses).toEqual([...Array(PACKED_PENDING).fill(STATUS.PENDING), STATUS.SUCCESS])
	})

	hostile("FIND-EMPTY-SCS", () => {
		const identifier = identifierOf(associated("FIND-EMPTY-SCS").session.receive(FIND))
		const emptySpecificCharacterSet = Buffer.from([0x08, 0x00, 0x05, 0x00, 0, 0, 0, 0])

		expect(identifier.subarray(0, emptySpecificCharacterSet.length)).toEqual(emptySpecificCharacterSet)
	})

	hostile("FIND-LATIN1", () => {
		const identifier = identifierOf(associated("FIND-LATIN1").session.receive(FIND))

		expect(identifier.includes(Buffer.from("ISO_IR 100", "ascii"))).toBe(true)
		expect(identifier.includes(Buffer.from(LATIN1_PATIENT_NAME, "latin1"))).toBe(true)
		expect(identifier.includes(Buffer.from(LATIN1_PATIENT_NAME, "utf8"))).toBe(false)
	})

	hostile("FIND-NO-CHARSET", () => {
		const identifier = identifierOf(associated("FIND-NO-CHARSET").session.receive(FIND))
		const specificCharacterSetTag = Buffer.from([0x08, 0x00, 0x05, 0x00])

		expect(identifier.includes(specificCharacterSetTag)).toBe(false)
		expect(identifier.includes(Buffer.from(ASCII_PATIENT_NAME, "ascii"))).toBe(true)
	})

	hostile("FIND-OVERSIZE", () => {
		const identifier = identifierOf(associated("FIND-OVERSIZE").session.receive(FIND))

		expect(identifier.length).toBeGreaterThan(OVERSIZED_IDENTIFIER_LENGTH)
		expect(responseCommandOf(sentBytes(associated("FIND-OVERSIZE").session.receive(ECHO))).status).toBe(STATUS.SUCCESS)
	})

	hostile("PEER-RELEASE", () => {
		const { session } = associated("PEER-RELEASE")
		const answer = session.receive(ECHO)
		const answered = pdusOf(sentBytes(answer)).map((pdu) => pdu.type)
		const afterResponse = session.receive(encodeReleaseResponse())

		expect(answered).toEqual([PDU_TYPE.DATA_TF, PDU_TYPE.RELEASE_RQ])
		expect(kinds(afterResponse)).toEqual(["close"])
	})

	it.each(["RSP-EARLY-OK", "ABORT-MID-DATA"])("%s refuses a data set that fits in one fragment", (calledAeTitle) => {
		const { session } = associated(calledAeTitle)
		session.receive(STORE_COMMAND)
		const last = session.receive(STORE_LAST)

		expect(pdusOf(sentBytes(last)).map((pdu) => pdu.type)).toEqual([PDU_TYPE.ABORT])
		expect(kinds(last)).toEqual(["send", "close"])
		expect(session.failure).toContain("at least two")
	})

	it("RSP-EARLY-OK answers C-ECHO normally", () => {
		const response = responseCommandOf(sentBytes(associated("RSP-EARLY-OK").session.receive(ECHO)))

		expect(response.status).toBe(STATUS.SUCCESS)
	})

	for (const { status } of STORE_GOLDEN) {
		hostile(storeScenario(status), () => {
			const { session } = associated(storeScenario(status))
			const { last } = store(session)

			expect(responseCommandOf(sentBytes(last)).status).toBe(status)
		})
	}

	for (const { status } of FIND_GOLDEN) {
		hostile(findScenario(status), () => {
			const statuses = commandsOf(associated(findScenario(status)).session.receive(FIND)).map(
				(command) => command.status,
			)

			expect(statuses).toEqual([STATUS.PENDING, status])
		})
	}

	for (const { status } of ECHO_GOLDEN) {
		hostile(echoScenario(status), () => {
			const [command] = commandsOf(associated(echoScenario(status)).session.receive(ECHO))

			expect([command?.commandField, command?.status]).toEqual([COMMAND_FIELD.C_ECHO_RSP, status])
		})
	}

	it("PS3.8 9.3.3.2 accepts a query context only in Implicit VR Little Endian, the encoding of its identifiers", () => {
		const proposal = (transferSyntaxes: string[]): PresentationContextProposal => ({
			id: FIND_CONTEXT,
			abstractSyntax: STUDY_ROOT_FIND,
			transferSyntaxes,
		})
		const request = parseAssociateRequest(pdusOf(associateRequest("BASELINE"))[0]?.body ?? Buffer.alloc(0))
		const results = acceptedContexts({
			...request,
			presentationContexts: [
				proposal([EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN]),
				proposal([EXPLICIT_VR_LITTLE_ENDIAN]),
			],
		})

		expect(results.map((result) => [result.result, result.transferSyntax])).toEqual([
			[PRESENTATION_CONTEXT_RESULT.ACCEPTANCE, IMPLICIT_VR_LITTLE_ENDIAN],
			[PRESENTATION_CONTEXT_RESULT.TRANSFER_SYNTAXES_NOT_SUPPORTED, ""],
		])
	})

	for (const rejection of REJECTION_GOLDEN) {
		hostile(rejectScenario(rejection), () => {
			const { accept } = associated(rejectScenario(rejection))
			const [rejectPdu] = pdusOf(sentBytes(accept))

			expect(rejectPdu?.type).toBe(PDU_TYPE.ASSOCIATE_RJ)
			const body = rejectPdu?.body ?? Buffer.alloc(0)
			expect([
				body.readUInt8(REJECT_FIELD.RESULT),
				body.readUInt8(REJECT_FIELD.SOURCE),
				body.readUInt8(REJECT_FIELD.REASON),
			]).toEqual([rejection.result, rejection.source, rejection.reason])
			expect(kinds(accept)).toContain("close")
		})
	}

	it("has a test for every case", () => {
		expect([...tested].sort()).toEqual(HOSTILE_CASES.map((hostileCase) => hostileCase.calledAeTitle).sort())
	})
})
