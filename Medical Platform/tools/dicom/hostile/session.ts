import {
	COMMAND_FIELD,
	type DimseCommand,
	decodeCommand,
	emptyCommand,
	encodeCommand,
	hasDataSet,
	STATUS,
} from "../dimse"
import {
	ABORT_SOURCE,
	type AssociateRequest,
	encodeAbort,
	encodeAssociateAccept,
	encodeAssociateReject,
	encodeReleaseResponse,
	fragmentMessage,
	PDU_TYPE,
	type Pdu,
	PduReader,
	PRESENTATION_CONTEXT_RESULT,
	PROFILE_MAX_PDU_LENGTH,
	type PresentationContextResult,
	parseAssociateRequest,
	parseDataPdu,
	REJECT_REASON,
	REJECT_RESULT,
	REJECT_SOURCE,
	UNLIMITED_PDU_LENGTH,
} from "../pdu"
import { HOSTILE_IMPLEMENTATION_CLASS_UID, HOSTILE_IMPLEMENTATION_VERSION_NAME } from "../synthetic"
import { IMPLICIT_VR_LITTLE_ENDIAN, MODALITY_WORKLIST_FIND, PATIENT_ROOT_FIND, STUDY_ROOT_FIND } from "../uids"

// PS3.4 C.4.1, K.4.1
const QUERY_ABSTRACT_SYNTAXES: ReadonlySet<string> = new Set([
	PATIENT_ROOT_FIND,
	STUDY_ROOT_FIND,
	MODALITY_WORKLIST_FIND,
])

const READ_LIMIT = 1_048_576
const ABORT_REASON_NOT_SPECIFIED = 0

export type HostileAction =
	| { kind: "send"; bytes: Buffer }
	| { kind: "close" }
	| { kind: "reset" }
	| { kind: "pause" }
	| { kind: "silence" }
	| { kind: "flood"; next: () => Buffer }

export interface AcceptedContext {
	id: number
	abstractSyntax: string
	transferSyntax: string
}

export interface Peer {
	request: AssociateRequest
	contexts: ReadonlyMap<number, AcceptedContext>
	maxPduLength: number
}

export interface InboundMessage {
	context: AcceptedContext
	command: DimseCommand
	datasetFragments: number
}

export interface HostileCase {
	readonly calledAeTitle: string
	readonly source: string
	associate?(request: AssociateRequest): HostileAction[]
	accepted?(peer: Peer): HostileAction[]
	datasetFragment?(peer: Peer, message: InboundMessage, isLast: boolean): HostileAction[]
	respond?(peer: Peer, message: InboundMessage): HostileAction[]
	release?(peer: Peer): HostileAction[]
}

interface MessageInProgress {
	context: AcceptedContext
	commandChunks: Buffer[]
	command: DimseCommand | undefined
	datasetFragments: number
}

const TERMINAL_ACTIONS: ReadonlySet<HostileAction["kind"]> = new Set(["close", "reset", "pause", "silence", "flood"])

export function send(bytes: Buffer): HostileAction {
	return { kind: "send", bytes }
}

export const CLOSE: HostileAction = { kind: "close" }
export const RESET: HostileAction = { kind: "reset" }
export const PAUSE: HostileAction = { kind: "pause" }
export const SILENCE: HostileAction = { kind: "silence" }

export function abortPdu(): Buffer {
	return encodeAbort(ABORT_SOURCE.SERVICE_PROVIDER, ABORT_REASON_NOT_SPECIFIED)
}

function acceptedContext(proposal: AssociateRequest["presentationContexts"][number]): PresentationContextResult {
	if (!QUERY_ABSTRACT_SYNTAXES.has(proposal.abstractSyntax)) {
		return {
			id: proposal.id,
			result: PRESENTATION_CONTEXT_RESULT.ACCEPTANCE,
			transferSyntax: proposal.transferSyntaxes[0] ?? "",
		}
	}
	return proposal.transferSyntaxes.includes(IMPLICIT_VR_LITTLE_ENDIAN)
		? { id: proposal.id, result: PRESENTATION_CONTEXT_RESULT.ACCEPTANCE, transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN }
		: { id: proposal.id, result: PRESENTATION_CONTEXT_RESULT.TRANSFER_SYNTAXES_NOT_SUPPORTED, transferSyntax: "" }
}

// PS3.8 9.3.3.2
export function acceptedContexts(request: AssociateRequest): PresentationContextResult[] {
	return request.presentationContexts.map(acceptedContext)
}

export function acceptPdu(request: AssociateRequest, contexts: readonly PresentationContextResult[]): Buffer {
	return encodeAssociateAccept({
		calledAeTitle: request.calledAeTitle,
		callingAeTitle: request.callingAeTitle,
		presentationContexts: [...contexts],
		maxPduLength: PROFILE_MAX_PDU_LENGTH,
		implementationClassUid: HOSTILE_IMPLEMENTATION_CLASS_UID,
		implementationVersionName: HOSTILE_IMPLEMENTATION_VERSION_NAME,
	})
}

export function messagePdus(peer: Peer, contextId: number, isCommand: boolean, bytes: Buffer): Buffer {
	return Buffer.concat(fragmentMessage(contextId, isCommand, bytes, peer.maxPduLength, PROFILE_MAX_PDU_LENGTH))
}

export function responseCommand(message: InboundMessage, commandField: number, status: number): DimseCommand {
	return {
		...emptyCommand(commandField),
		messageIdBeingRespondedTo: message.command.messageId,
		affectedSopClassUid: message.command.affectedSopClassUid,
		affectedSopInstanceUid: message.command.affectedSopInstanceUid,
		status,
	}
}

export function responsePdus(peer: Peer, message: InboundMessage, command: DimseCommand): Buffer {
	return messagePdus(peer, message.context.id, true, encodeCommand(command))
}

// PS3.7 9.3.1.2, 9.3.2.2, 9.3.5.2
const RESPONSE_FIELD: ReadonlyMap<number, number> = new Map([
	[COMMAND_FIELD.C_ECHO_RQ, COMMAND_FIELD.C_ECHO_RSP],
	[COMMAND_FIELD.C_STORE_RQ, COMMAND_FIELD.C_STORE_RSP],
	[COMMAND_FIELD.C_FIND_RQ, COMMAND_FIELD.C_FIND_RSP],
])

export function successCommand(message: InboundMessage): DimseCommand | undefined {
	const responseField = RESPONSE_FIELD.get(message.command.commandField)
	return responseField === undefined ? undefined : responseCommand(message, responseField, STATUS.SUCCESS)
}

export function successResponse(peer: Peer, message: InboundMessage): HostileAction[] {
	const command = successCommand(message)
	return command === undefined ? [] : [send(responsePdus(peer, message, command))]
}

function isTerminal(actions: readonly HostileAction[]): boolean {
	return actions.some((action) => TERMINAL_ACTIONS.has(action.kind))
}

export class HostileCaseError extends Error {}

export class HostileSession {
	private readonly reader = new PduReader(READ_LIMIT)
	private request: AssociateRequest | undefined
	private peer: Peer | undefined
	private hostileCase: HostileCase | undefined
	private message: MessageInProgress | undefined
	private finished = false
	private failureReason: string | undefined

	constructor(private readonly cases: ReadonlyMap<string, HostileCase>) {}

	get failure(): string | undefined {
		return this.failureReason
	}

	get calledAeTitle(): string | undefined {
		return this.request?.calledAeTitle
	}

	get callingAeTitle(): string | undefined {
		return this.request?.callingAeTitle
	}

	receive(chunk: Buffer): HostileAction[] {
		if (this.finished) {
			return []
		}
		const actions: HostileAction[] = []
		try {
			for (const pdu of this.reader.push(chunk)) {
				actions.push(...this.handle(pdu))
				if (this.finished) {
					break
				}
			}
		} catch (error) {
			this.finished = true
			this.failureReason = error instanceof Error ? error.message : String(error)
			return [...actions, send(abortPdu()), CLOSE]
		}
		return actions
	}

	private finish(actions: HostileAction[]): HostileAction[] {
		if (isTerminal(actions)) {
			this.finished = true
		}
		return actions
	}

	private handle(pdu: Pdu): HostileAction[] {
		switch (pdu.type) {
			case PDU_TYPE.ASSOCIATE_RQ:
				return this.finish(this.associate(parseAssociateRequest(pdu.body)))
			case PDU_TYPE.DATA_TF:
				return this.finish(this.data(pdu.body))
			case PDU_TYPE.RELEASE_RQ:
				return this.finish(this.release())
			default:
				return this.finish([CLOSE])
		}
	}

	private associate(request: AssociateRequest): HostileAction[] {
		this.request = request
		const hostileCase = this.cases.get(request.calledAeTitle)
		if (hostileCase === undefined) {
			return [
				send(
					encodeAssociateReject(
						REJECT_RESULT.PERMANENT,
						REJECT_SOURCE.SERVICE_USER,
						REJECT_REASON.CALLED_AE_TITLE_NOT_RECOGNIZED,
					),
				),
				CLOSE,
			]
		}
		this.hostileCase = hostileCase
		if (hostileCase.associate !== undefined) {
			return hostileCase.associate(request)
		}
		const results = acceptedContexts(request)
		const contexts = new Map(
			request.presentationContexts.flatMap((proposal, index) => {
				const result = results[index]
				return result?.result === PRESENTATION_CONTEXT_RESULT.ACCEPTANCE
					? [
							[
								proposal.id,
								{ id: proposal.id, abstractSyntax: proposal.abstractSyntax, transferSyntax: result.transferSyntax },
							],
						]
					: []
			}),
		)
		this.peer = { request, contexts, maxPduLength: request.maxPduLength ?? UNLIMITED_PDU_LENGTH }
		return [send(acceptPdu(request, results)), ...(hostileCase.accepted?.(this.peer) ?? [])]
	}

	private data(body: Buffer): HostileAction[] {
		const peer = this.peer
		const hostileCase = this.hostileCase
		if (peer === undefined || hostileCase === undefined) {
			return [send(abortPdu()), CLOSE]
		}
		const actions: HostileAction[] = []
		for (const value of parseDataPdu(body)) {
			const context = peer.contexts.get(value.contextId)
			if (context === undefined) {
				return [...actions, send(abortPdu()), CLOSE]
			}
			const message = this.message ?? { context, commandChunks: [], command: undefined, datasetFragments: 0 }
			this.message = message
			if (value.isCommand) {
				message.commandChunks.push(value.data)
				if (!value.isLast) {
					continue
				}
				message.command = decodeCommand(Buffer.concat(message.commandChunks))
				if (!hasDataSet(message.command)) {
					actions.push(...this.complete(peer, hostileCase, { context, command: message.command, datasetFragments: 0 }))
				}
				if (isTerminal(actions)) {
					return actions
				}
				continue
			}
			if (message.command === undefined) {
				return [...actions, send(abortPdu()), CLOSE]
			}
			message.datasetFragments += 1
			const inbound = { context, command: message.command, datasetFragments: message.datasetFragments }
			actions.push(...(hostileCase.datasetFragment?.(peer, inbound, value.isLast) ?? []))
			if (isTerminal(actions)) {
				return actions
			}
			if (value.isLast) {
				actions.push(...this.complete(peer, hostileCase, inbound))
				if (isTerminal(actions)) {
					return actions
				}
			}
		}
		return actions
	}

	private complete(peer: Peer, hostileCase: HostileCase, inbound: InboundMessage): HostileAction[] {
		this.message = undefined
		if (hostileCase.respond !== undefined) {
			return hostileCase.respond(peer, inbound)
		}
		return successResponse(peer, inbound)
	}

	private release(): HostileAction[] {
		const peer = this.peer
		if (peer !== undefined && this.hostileCase?.release !== undefined) {
			return this.hostileCase.release(peer)
		}
		return [send(encodeReleaseResponse()), CLOSE]
	}
}
