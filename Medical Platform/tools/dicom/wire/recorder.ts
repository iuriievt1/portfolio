import { createHash, type Hash } from "node:crypto"
import { type DimseCommand, decodeCommand, hasDataSet } from "../dimse"
import {
	ABORT_FIELD,
	type AssociateAccept,
	type AssociateRequest,
	PDU_HEADER_LENGTH,
	PDU_TYPE,
	PDV_COMMAND_FLAG,
	PDV_CONTEXT_OFFSET,
	PDV_CONTROL_OFFSET,
	PDV_HEADER_LENGTH,
	PDV_LAST_FLAG,
	PDV_LENGTH_FIELD,
	parseAssociateAccept,
	parseAssociateRequest,
	REJECT_FIELD,
	SHORT_PDU_BODY_LENGTH,
} from "../pdu"

// integrace-dicom.md 9.1, 11.1

export type Direction = "client-to-peer" | "peer-to-client"

const SMALL_PDU_LIMIT = 1_048_576
const COMMAND_LIMIT = 65_536
const HEX_RADIX = 16
const HEX_WORD_DIGITS = 4

// PS3.8 9.3.4, 9.3.6, 9.3.7, 9.3.8
const SHORT_PDUS: ReadonlySet<number> = new Set([
	PDU_TYPE.ASSOCIATE_RJ,
	PDU_TYPE.RELEASE_RQ,
	PDU_TYPE.RELEASE_RP,
	PDU_TYPE.ABORT,
])

const PDU_NAMES: ReadonlyMap<number, string> = new Map([
	[PDU_TYPE.ASSOCIATE_RQ, "A-ASSOCIATE-RQ"],
	[PDU_TYPE.ASSOCIATE_AC, "A-ASSOCIATE-AC"],
	[PDU_TYPE.ASSOCIATE_RJ, "A-ASSOCIATE-RJ"],
	[PDU_TYPE.DATA_TF, "P-DATA-TF"],
	[PDU_TYPE.RELEASE_RQ, "A-RELEASE-RQ"],
	[PDU_TYPE.RELEASE_RP, "A-RELEASE-RP"],
	[PDU_TYPE.ABORT, "A-ABORT"],
])

export interface PduEntry {
	sequence: number
	direction: Direction
	offset: number
	type: string
	declaredLength: number
	atMs: number
	problem: string | undefined
}

export interface WireCommand {
	commandField: string
	messageId: number | undefined
	messageIdBeingRespondedTo: number | undefined
	statusHex: string | undefined
	affectedSopClassUid: string | undefined
	affectedSopInstanceUid: string | undefined
	dataSetPresent: boolean
}

export interface WireMessage {
	direction: Direction
	contextId: number
	transferSyntax: string | undefined
	command: WireCommand | undefined
	problems: string[]
	dataset: { bytes: number; sha256: string; fragments: number; maxFragment: number } | undefined
	complete: boolean
	firstSequence: number
	lastSequence: number
}

export interface DirectionSummary {
	bytes: number
	pduCounts: Record<string, number>
	maxDataPduLength: number
	problems: { sequence: number; problem: string }[]
}

export interface ConnectionRecord {
	association: {
		request: AssociateRequest | undefined
		accept: AssociateAccept | undefined
		reject: { result: number; source: number; reason: number } | undefined
		releaseRequestedBy: Direction | undefined
		releaseResponded: boolean
		abort: { by: Direction; source: number; reason: number } | undefined
	}
	clientToPeer: DirectionSummary
	peerToClient: DirectionSummary
	messages: WireMessage[]
	pdus: PduEntry[]
}

interface MessageAssembly {
	contextId: number
	commandChunks: Buffer[]
	commandBytes: number
	command: DimseCommand | undefined
	problems: string[]
	hash: Hash | undefined
	datasetBytes: number
	fragments: number
	maxFragment: number
	firstSequence: number
	lastSequence: number
}

interface PdvInProgress {
	header: Buffer
	contextId: number
	isCommand: boolean
	isLast: boolean
	remaining: number
}

interface PduInProgress {
	type: number
	entry: PduEntry
	pdvs: number
	remaining: number
	small: Buffer[] | undefined
	pdv: PdvInProgress | undefined
}

interface DirectionState {
	direction: Direction
	header: Buffer
	pdu: PduInProgress | undefined
	message: MessageAssembly | undefined
	summary: DirectionSummary
}

// integrace-dicom.md 6.2
export function hexWord(value: number): string {
	return value.toString(HEX_RADIX).toUpperCase().padStart(HEX_WORD_DIGITS, "0")
}

function wireCommand(command: DimseCommand): WireCommand {
	return {
		commandField: hexWord(command.commandField),
		messageId: command.messageId,
		messageIdBeingRespondedTo: command.messageIdBeingRespondedTo,
		statusHex: command.status === undefined ? undefined : hexWord(command.status),
		affectedSopClassUid: command.affectedSopClassUid,
		affectedSopInstanceUid: command.affectedSopInstanceUid,
		dataSetPresent: hasDataSet(command),
	}
}

function directionState(direction: Direction): DirectionState {
	return {
		direction,
		header: Buffer.alloc(0),
		pdu: undefined,
		message: undefined,
		summary: { bytes: 0, pduCounts: {}, maxDataPduLength: 0, problems: [] },
	}
}

function problemOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export class ConnectionRecorder {
	private readonly started = Date.now()
	private sequence = 0
	private readonly states: Record<Direction, DirectionState> = {
		"client-to-peer": directionState("client-to-peer"),
		"peer-to-client": directionState("peer-to-client"),
	}
	private readonly record: ConnectionRecord

	constructor() {
		this.record = {
			association: {
				request: undefined,
				accept: undefined,
				reject: undefined,
				releaseRequestedBy: undefined,
				releaseResponded: false,
				abort: undefined,
			},
			clientToPeer: this.states["client-to-peer"].summary,
			peerToClient: this.states["peer-to-client"].summary,
			messages: [],
			pdus: [],
		}
	}

	messagesFrom(direction: Direction): readonly WireMessage[] {
		return this.record.messages.filter((message) => message.direction === direction)
	}

	receive(direction: Direction, chunk: Buffer): void {
		const state = this.states[direction]
		state.summary.bytes += chunk.length
		let offset = 0
		while (offset < chunk.length) {
			offset += state.pdu === undefined ? this.readHeader(state, chunk, offset) : this.readBody(state, chunk, offset)
		}
	}

	finish(): ConnectionRecord {
		for (const state of Object.values(this.states)) {
			if (state.header.length > 0) {
				state.summary.problems.push({
					sequence: this.sequence + 1,
					problem: `connection ended ${PDU_HEADER_LENGTH - state.header.length} bytes before the PDU header end`,
				})
				state.header = Buffer.alloc(0)
			}
			if (state.pdu !== undefined) {
				this.problem(state, state.pdu.entry, `connection ended ${state.pdu.remaining} bytes before the PDU end`)
				state.pdu = undefined
			}
			if (state.message !== undefined) {
				this.closeMessage(state, false)
			}
		}
		return this.record
	}

	private problem(state: DirectionState, entry: PduEntry, problem: string): void {
		entry.problem ??= problem
		state.summary.problems.push({ sequence: entry.sequence, problem })
	}

	private readHeader(state: DirectionState, chunk: Buffer, offset: number): number {
		const needed = PDU_HEADER_LENGTH - state.header.length
		const taken = chunk.subarray(offset, offset + needed)
		state.header = Buffer.concat([state.header, taken])
		if (state.header.length < PDU_HEADER_LENGTH) {
			return taken.length
		}
		const type = state.header.readUInt8(0)
		const declaredLength = state.header.readUInt32BE(2)
		state.header = Buffer.alloc(0)
		const name = PDU_NAMES.get(type) ?? `unknown-0x${type.toString(HEX_RADIX).padStart(2, "0")}`
		this.sequence += 1
		const entry: PduEntry = {
			sequence: this.sequence,
			direction: state.direction,
			offset: state.summary.bytes - (chunk.length - offset - taken.length) - PDU_HEADER_LENGTH,
			type: name,
			declaredLength,
			atMs: Date.now() - this.started,
			problem: undefined,
		}
		this.record.pdus.push(entry)
		state.summary.pduCounts[name] = (state.summary.pduCounts[name] ?? 0) + 1
		if (type === PDU_TYPE.DATA_TF) {
			state.summary.maxDataPduLength = Math.max(state.summary.maxDataPduLength, declaredLength)
		}
		const small = type !== PDU_TYPE.DATA_TF && declaredLength <= SMALL_PDU_LIMIT ? [] : undefined
		if (type !== PDU_TYPE.DATA_TF && small === undefined) {
			this.problem(state, entry, `declares ${declaredLength} bytes, over the ${SMALL_PDU_LIMIT} bytes recorded`)
		}
		state.pdu = { type, entry, pdvs: 0, remaining: declaredLength, small, pdv: undefined }
		if (declaredLength === 0) {
			this.completePdu(state)
		}
		return taken.length
	}

	private readBody(state: DirectionState, chunk: Buffer, offset: number): number {
		const pdu = state.pdu
		if (pdu === undefined) {
			return 0
		}
		const taken = chunk.subarray(offset, offset + pdu.remaining)
		pdu.remaining -= taken.length
		if (pdu.type === PDU_TYPE.DATA_TF) {
			this.readPdvs(state, pdu, taken)
		} else {
			pdu.small?.push(taken)
		}
		if (pdu.remaining === 0) {
			this.completePdu(state)
		}
		return taken.length
	}

	private readPdvs(state: DirectionState, pdu: PduInProgress, bytes: Buffer): void {
		let offset = 0
		while (offset < bytes.length && pdu.entry.problem === undefined) {
			if (pdu.pdv === undefined || pdu.pdv.header.length < PDV_HEADER_LENGTH) {
				offset += this.readPdvHeader(state, pdu, bytes, offset)
				continue
			}
			const pdv = pdu.pdv
			const data = bytes.subarray(offset, offset + pdv.remaining)
			pdv.remaining -= data.length
			offset += data.length
			this.pdvData(state, pdv, data, pdu.entry.sequence)
			if (pdv.remaining === 0) {
				this.pdvComplete(state, pdv, pdu.entry.sequence)
				pdu.pdv = undefined
			}
		}
	}

	private readPdvHeader(state: DirectionState, pdu: PduInProgress, bytes: Buffer, offset: number): number {
		const current = pdu.pdv?.header ?? Buffer.alloc(0)
		const taken = bytes.subarray(offset, offset + PDV_HEADER_LENGTH - current.length)
		const header = Buffer.concat([current, taken])
		if (header.length < PDV_HEADER_LENGTH) {
			pdu.pdv = { header, contextId: 0, isCommand: false, isLast: false, remaining: 0 }
			return taken.length
		}
		const itemLength = header.readUInt32BE(0)
		const dataLength = itemLength - (PDV_HEADER_LENGTH - PDV_LENGTH_FIELD)
		if (dataLength < 0 || dataLength > pdu.remaining + (bytes.length - offset - taken.length)) {
			this.problem(state, pdu.entry, `PDV declares ${itemLength} bytes past its PDU`)
			pdu.pdv = undefined
			return taken.length
		}
		const control = header.readUInt8(PDV_CONTROL_OFFSET)
		pdu.pdvs += 1
		pdu.pdv = {
			header,
			contextId: header.readUInt8(PDV_CONTEXT_OFFSET),
			isCommand: (control & PDV_COMMAND_FLAG) !== 0,
			isLast: (control & PDV_LAST_FLAG) !== 0,
			remaining: dataLength,
		}
		if (dataLength === 0) {
			this.pdvComplete(state, pdu.pdv, pdu.entry.sequence)
			pdu.pdv = undefined
		}
		return taken.length
	}

	private assembly(state: DirectionState, pdv: PdvInProgress, sequence: number): MessageAssembly {
		if (state.message === undefined) {
			state.message = {
				contextId: pdv.contextId,
				commandChunks: [],
				commandBytes: 0,
				command: undefined,
				problems: [],
				hash: undefined,
				datasetBytes: 0,
				fragments: 0,
				maxFragment: 0,
				firstSequence: sequence,
				lastSequence: sequence,
			}
		}
		state.message.lastSequence = sequence
		if (state.message.contextId !== pdv.contextId) {
			state.message.problems.push(
				`PDV on context ${pdv.contextId} inside a message on context ${state.message.contextId}`,
			)
		}
		return state.message
	}

	private pdvData(state: DirectionState, pdv: PdvInProgress, data: Buffer, sequence: number): void {
		if (pdv.isCommand && state.message?.command !== undefined) {
			this.closeMessage(state, false)
		}
		const message = this.assembly(state, pdv, sequence)
		if (pdv.isCommand) {
			message.commandBytes += data.length
			if (message.commandBytes <= COMMAND_LIMIT) {
				message.commandChunks.push(data)
			}
			return
		}
		message.hash ??= createHash("sha256")
		message.hash.update(data)
		message.datasetBytes += data.length
	}

	private pdvComplete(state: DirectionState, pdv: PdvInProgress, sequence: number): void {
		const message = this.assembly(state, pdv, sequence)
		if (pdv.isCommand) {
			if (pdv.isLast) {
				this.decode(message)
				if (message.command !== undefined && !hasDataSet(message.command)) {
					this.closeMessage(state, true)
				}
				if (message.command === undefined) {
					this.closeMessage(state, false)
				}
			}
			return
		}
		const fragment = pdv.header.readUInt32BE(0) - (PDV_HEADER_LENGTH - PDV_LENGTH_FIELD)
		message.hash ??= createHash("sha256")
		message.fragments += 1
		message.maxFragment = Math.max(message.maxFragment, fragment)
		if (pdv.isLast) {
			this.closeMessage(state, message.command !== undefined)
		}
	}

	private decode(message: MessageAssembly): void {
		if (message.commandBytes > COMMAND_LIMIT) {
			message.problems.push(`command set of ${message.commandBytes} bytes, over the ${COMMAND_LIMIT} bytes decoded`)
			return
		}
		try {
			message.command = decodeCommand(Buffer.concat(message.commandChunks))
		} catch (error) {
			message.problems.push(problemOf(error))
		}
	}

	private closeMessage(state: DirectionState, complete: boolean): void {
		const message = state.message
		if (message === undefined) {
			return
		}
		state.message = undefined
		const accepted = this.record.association.accept?.presentationContexts.find(
			(context) => context.id === message.contextId,
		)
		this.record.messages.push({
			direction: state.direction,
			contextId: message.contextId,
			transferSyntax: accepted?.transferSyntax,
			command: message.command === undefined ? undefined : wireCommand(message.command),
			problems: message.problems,
			dataset:
				message.hash === undefined
					? undefined
					: {
							bytes: message.datasetBytes,
							sha256: message.hash.digest("hex"),
							fragments: message.fragments,
							maxFragment: message.maxFragment,
						},
			complete,
			firstSequence: message.firstSequence,
			lastSequence: message.lastSequence,
		})
	}

	private completePdu(state: DirectionState): void {
		const pdu = state.pdu
		state.pdu = undefined
		if (pdu === undefined) {
			return
		}
		if (pdu.type === PDU_TYPE.DATA_TF) {
			if (pdu.pdv !== undefined && pdu.entry.problem === undefined) {
				this.problem(state, pdu.entry, "PDU ends inside a PDV")
			}
			// PS3.8 9.3.5
			if (pdu.pdvs === 0 && pdu.entry.problem === undefined) {
				this.problem(state, pdu.entry, "P-DATA-TF has no PDV")
			}
			return
		}
		if (pdu.small === undefined) {
			return
		}
		try {
			this.association(state, pdu, Buffer.concat(pdu.small))
		} catch (error) {
			this.problem(state, pdu.entry, problemOf(error))
		}
	}

	private association(state: DirectionState, pdu: PduInProgress, body: Buffer): void {
		const association = this.record.association
		if (SHORT_PDUS.has(pdu.type) && body.length !== SHORT_PDU_BODY_LENGTH) {
			this.problem(state, pdu.entry, `${pdu.entry.type} has ${body.length} bytes, not ${SHORT_PDU_BODY_LENGTH}`)
			return
		}
		switch (pdu.type) {
			case PDU_TYPE.ASSOCIATE_RQ:
				association.request = parseAssociateRequest(body)
				return
			case PDU_TYPE.ASSOCIATE_AC:
				association.accept = parseAssociateAccept(body)
				return
			case PDU_TYPE.ASSOCIATE_RJ:
				association.reject = {
					result: body.readUInt8(REJECT_FIELD.RESULT),
					source: body.readUInt8(REJECT_FIELD.SOURCE),
					reason: body.readUInt8(REJECT_FIELD.REASON),
				}
				return
			case PDU_TYPE.RELEASE_RQ:
				association.releaseRequestedBy ??= state.direction
				return
			case PDU_TYPE.RELEASE_RP:
				association.releaseResponded = true
				return
			case PDU_TYPE.ABORT:
				association.abort ??= {
					by: state.direction,
					source: body.readUInt8(ABORT_FIELD.SOURCE),
					reason: body.readUInt8(ABORT_FIELD.REASON),
				}
				return
			default:
				return
		}
	}
}
