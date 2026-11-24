import type { Duplex } from "node:stream"
import { COMMAND_FIELD, STATUS } from "../dimse"
import { PRESENTATION_CONTEXT_RESULT, PROFILE_MAX_PDU_LENGTH } from "../pdu"
import { hexWord } from "../wire/recorder"
import { echo } from "./echo"
import type { DicomTarget } from "./peers"
import { readWireConnections, type WireConnection } from "./wire-records"

export interface WireSummary {
	connection: number
	statusHex: string | undefined
	maxDataPduLength: { clientToPeer: number; peerToClient: number }
}

export type PeerOutcome =
	| {
			target: string
			result: "pass"
			durationMs: number
			statusHex: string
			acceptedTransferSyntax: string
			peerMaxPduLength: number
			peerImplementationClassUid: string
			wire: WireSummary | undefined
	  }
	| { target: string; result: "fail"; durationMs: number; reason: string; wire: WireSummary | undefined }

export interface CheckResult {
	id: string
	source: string
	result: "pass" | "fail"
	peers: PeerOutcome[]
}

const ECHO_REQUEST = hexWord(COMMAND_FIELD.C_ECHO_RQ)
const ECHO_RESPONSE = hexWord(COMMAND_FIELD.C_ECHO_RSP)
const SUCCESS = hexWord(STATUS.SUCCESS)

function label(target: DicomTarget): string {
	return `${target.aeTitle}@${target.peer}`
}

async function reach(
	target: DicomTarget,
	callingAeTitle: string,
	open: (target: DicomTarget) => Promise<Duplex>,
	timeoutMs: number,
): Promise<PeerOutcome> {
	const started = Date.now()
	try {
		const outcome = await echo(await open(target), callingAeTitle, target.aeTitle, timeoutMs)
		const durationMs = Date.now() - started
		if (outcome.status !== STATUS.SUCCESS) {
			const reason = `C-ECHO status ${hexWord(outcome.status)}`
			return { target: label(target), result: "fail", durationMs, reason, wire: undefined }
		}
		return {
			target: label(target),
			result: "pass",
			durationMs,
			statusHex: hexWord(outcome.status),
			acceptedTransferSyntax: outcome.acceptedTransferSyntax,
			peerMaxPduLength: outcome.peerMaxPduLength,
			peerImplementationClassUid: outcome.peerImplementationClassUid,
			wire: undefined,
		}
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		return { target: label(target), result: "fail", durationMs: Date.now() - started, reason, wire: undefined }
	}
}

export async function connectivity(
	targets: readonly DicomTarget[],
	callingAeTitle: string,
	open: (target: DicomTarget) => Promise<Duplex>,
	timeoutMs: number,
): Promise<CheckResult> {
	const peers: PeerOutcome[] = []
	for (const target of targets) {
		peers.push(await reach(target, callingAeTitle, open, timeoutMs))
	}
	return {
		id: "connectivity",
		source: "ADR-017, Q-041, integrace-dicom.md 9.1, 11",
		result: peers.every((peer) => peer.result === "pass") ? "pass" : "fail",
		peers,
	}
}

// integrace-dicom.md 6.3, 9.1, 10
export function wireEchoProblem(
	connection: WireConnection,
	callingAeTitle: string,
	calledAeTitle: string,
): string | undefined {
	const { request, accept, reject, abort, releaseRequestedBy, releaseResponded } = connection.association
	if (request?.callingAeTitle !== callingAeTitle || request.calledAeTitle !== calledAeTitle) {
		return "the A-ASSOCIATE-RQ on the wire names other AE titles"
	}
	if (reject !== undefined) {
		return `the association was rejected on the wire ${reject.result}/${reject.source}/${reject.reason}`
	}
	const proposed = request.presentationContexts[0]
	const accepted = accept?.presentationContexts.find((context) => context.id === proposed?.id)
	if (accepted?.result !== PRESENTATION_CONTEXT_RESULT.ACCEPTANCE) {
		return "the Verification context was not accepted on the wire"
	}
	if (abort !== undefined) {
		return `A-ABORT from ${abort.by} on the wire`
	}
	const problems = [...connection.clientToPeer.problems, ...connection.peerToClient.problems]
	if (problems.length > 0) {
		return `PDU problems on the wire: ${problems.map((problem) => problem.problem).join("; ")}`
	}
	if (connection.clientToPeer.maxDataPduLength > Math.min(PROFILE_MAX_PDU_LENGTH, accept?.maxPduLength || Infinity)) {
		return `the client sent a P-DATA-TF of ${connection.clientToPeer.maxDataPduLength} bytes over the peer's limit`
	}
	if (connection.peerToClient.maxDataPduLength > PROFILE_MAX_PDU_LENGTH) {
		return `the peer sent a P-DATA-TF of ${connection.peerToClient.maxDataPduLength} bytes over ${PROFILE_MAX_PDU_LENGTH}`
	}
	const [requestMessage, responseMessage, ...others] = connection.messages
	if (
		requestMessage?.direction !== "client-to-peer" ||
		requestMessage.command?.commandField !== ECHO_REQUEST ||
		!requestMessage.complete
	) {
		return "no complete C-ECHO-RQ on the wire"
	}
	if (
		responseMessage?.direction !== "peer-to-client" ||
		responseMessage.command?.commandField !== ECHO_RESPONSE ||
		responseMessage.command.messageIdBeingRespondedTo !== requestMessage.command.messageId ||
		!responseMessage.complete
	) {
		return "no complete C-ECHO-RSP to the request on the wire"
	}
	if (others.length > 0) {
		return `${others.length} unexpected DIMSE message(s) on the wire`
	}
	if (responseMessage.command.statusHex !== SUCCESS) {
		return `C-ECHO-RSP status ${responseMessage.command.statusHex} on the wire`
	}
	if (releaseRequestedBy !== "client-to-peer" || !releaseResponded) {
		return "no release requested by the client and answered by the peer on the wire"
	}
	return undefined
}

function wireSummary(connection: WireConnection): WireSummary {
	const response = connection.messages.find((message) => message.command?.commandField === ECHO_RESPONSE)
	return {
		connection: connection.connection,
		statusHex: response?.command?.statusHex,
		maxDataPduLength: {
			clientToPeer: connection.clientToPeer.maxDataPduLength,
			peerToClient: connection.peerToClient.maxDataPduLength,
		},
	}
}

function confirmPeer(
	outcome: PeerOutcome,
	target: DicomTarget,
	connections: readonly WireConnection[],
	callingAeTitle: string,
): PeerOutcome {
	const [connection] = connections
	if (connections.length !== 1 || connection === undefined) {
		const reason = `${connections.length} connections recorded on the wire, expected 1`
		return { target: outcome.target, result: "fail", durationMs: outcome.durationMs, reason, wire: undefined }
	}
	const wire = wireSummary(connection)
	if (outcome.result === "fail") {
		return { ...outcome, wire }
	}
	const problem = wireEchoProblem(connection, callingAeTitle, target.aeTitle)
	if (problem !== undefined) {
		return { target: outcome.target, result: "fail", durationMs: outcome.durationMs, reason: `wire: ${problem}`, wire }
	}
	if (wire.statusHex !== outcome.statusHex) {
		const reason = `the client saw status ${outcome.statusHex}, the wire carried ${wire.statusHex}`
		return { target: outcome.target, result: "fail", durationMs: outcome.durationMs, reason, wire }
	}
	return { ...outcome, wire }
}

export function confirmFromWire(
	check: CheckResult,
	targets: readonly DicomTarget[],
	wireEvidence: string,
	callingAeTitle: string,
): CheckResult {
	const peers = check.peers.map((outcome, index) => {
		const target = targets[index]
		if (target === undefined) {
			return outcome
		}
		return confirmPeer(outcome, target, readWireConnections(wireEvidence, target.peer), callingAeTitle)
	})
	return { ...check, result: peers.every((peer) => peer.result === "pass") ? "pass" : "fail", peers }
}
