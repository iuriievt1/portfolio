import { performance } from "node:perf_hooks"
import { type association, Client, constants } from "@veevoy/dcmjs-dimse"
import {
	ASSOCIATION_OUTCOME,
	type AssociationOutcome,
	type AssociationRejection,
	type AssociationReport,
	type DimseTarget,
	type DimseTimeouts,
	type DimseTimings,
	type ReceivedAbort,
	type TimeoutKind,
} from "./contract"

// konfigurace-a-profily.md 2.7, integrace-dicom.md 6.3 (?)
export const DEFAULT_TIMEOUTS: DimseTimeouts = {
	connectMs: 10_000,
	acseMs: 30_000,
	dimseMs: 120_000,
	idleMs: 300_000,
}

// TS-059, integrace-dicom.md 6.3, 10
export const DEFAULT_MAX_PDU_LENGTH = 16_384

// integrace-dicom.md 6.1, CS ř. 1618, 2401
export const DEFAULT_QUERY_TRANSFER_SYNTAXES: readonly string[] = [constants.TransferSyntax.ImplicitVRLittleEndian]

// PS3.5 6.2 AE
const AE_TITLE_PATTERN = /^[\x20-\x5b\x5d-\x7e]{1,16}$/
const MAX_PORT = 65_535

// ADR-017, Q-045, CAP-012-R17, integrace-dicom.md 5.0
export interface ImplementationIdentity {
	implementationClassUid: string
	implementationVersionName?: string
}

export interface SessionEnd {
	association: AssociationReport
	timingsMs: DimseTimings
	abortedByUs: boolean
	acceptedTransferSyntaxes: ReadonlyMap<number, string>
	negotiated: association.Association | undefined
}

export interface Session {
	client: Client
	markResponded(): void
	abort(): void
	isAssociated(): boolean
	ended: Promise<SessionEnd>
}

// integrace-dicom.md 6.1, PS3.5 6.2
export function checkTarget(target: DimseTarget): void {
	if (typeof target.host !== "string" || target.host.length === 0) {
		throw new TypeError("the target has no host")
	}
	if (!Number.isInteger(target.port) || target.port < 1 || target.port > MAX_PORT) {
		throw new RangeError(`the target port ${target.port} is not a TCP port`)
	}
	for (const aeTitle of [target.callingAeTitle, target.calledAeTitle]) {
		if (!AE_TITLE_PATTERN.test(aeTitle) || aeTitle.trim().length === 0) {
			throw new RangeError(`the AE title "${aeTitle}" is not 1 to 16 characters of the default repertoire`)
		}
	}
}

function sendOptions(target: DimseTarget, identity: ImplementationIdentity) {
	return {
		implementationClassUid: identity.implementationClassUid,
		...(identity.implementationVersionName === undefined
			? {}
			: { implementationVersion: identity.implementationVersionName }),
		connectTimeout: target.timeouts?.connectMs ?? DEFAULT_TIMEOUTS.connectMs,
		acseTimeout: target.timeouts?.acseMs ?? DEFAULT_TIMEOUTS.acseMs,
		dimseTimeout: target.timeouts?.dimseMs ?? DEFAULT_TIMEOUTS.dimseMs,
		idleTimeout: target.timeouts?.idleMs ?? DEFAULT_TIMEOUTS.idleMs,
		maxPduLength: target.maxPduLength ?? DEFAULT_MAX_PDU_LENGTH,
		queryTransferSyntaxes: [...(target.queryTransferSyntaxes ?? DEFAULT_QUERY_TRANSFER_SYNTAXES)],
	}
}

function elapsedSince(start: number): number {
	return Math.round(performance.now() - start)
}

// integrace-dicom.md 6.2, 8.3
export function openSession(
	target: DimseTarget,
	identity: ImplementationIdentity,
	prepare: (client: Client) => void,
	signal: AbortSignal | undefined,
): Session {
	const start = performance.now()
	const client = new Client()
	const timings: { connectedMs?: number; associatedMs?: number; respondedMs?: number } = {}
	const acceptedTransferSyntaxes = new Map<number, string>()
	let negotiated: association.Association | undefined
	let rejection: AssociationRejection | undefined
	let abort: ReceivedAbort | undefined
	let associated = false
	let closed = false
	let abortedByUs = false

	const abortLocally = () => {
		if (closed) {
			return
		}
		abortedByUs = true
		client.abort(constants.AbortSource.ServiceUser, constants.AbortReason.NotSpecified)
	}

	prepare(client)
	const ended = new Promise<SessionEnd>((resolve) => {
		client.on("connected", () => {
			timings.connectedMs = elapsedSince(start)
		})
		client.on("associationAccepted", (accepted: association.Association) => {
			associated = true
			negotiated = accepted
			timings.associatedMs = elapsedSince(start)
			for (const { id, context } of accepted.getPresentationContexts()) {
				const transferSyntax = context.getAcceptedTransferSyntaxUid()
				if (context.getResult() === constants.PresentationContextResult.Accept && transferSyntax !== undefined) {
					acceptedTransferSyntaxes.set(id, transferSyntax)
				}
			}
		})
		client.on("associationRejected", (rejected: AssociationRejection) => {
			rejection = { result: rejected.result, source: rejected.source, reason: rejected.reason }
		})
		client.on("abort", (received: ReceivedAbort) => {
			abort = { source: received.source, reason: received.reason }
		})
		client.on("closed", (end: { outcome: string; timeout?: string }) => {
			signal?.removeEventListener("abort", abortLocally)
			closed = true
			associated = false
			resolve({
				association: {
					outcome: end.outcome as AssociationOutcome,
					timeout: end.timeout as TimeoutKind | undefined,
					rejection,
					abort,
					peerMaxPduLength: negotiated?.getPeerMaxPduLength(),
					peerImplementationClassUid: negotiated?.getPeerImplementationClassUid(),
					peerImplementationVersionName: negotiated?.getPeerImplementationVersion(),
				},
				timingsMs: {
					connectedMs: timings.connectedMs,
					associatedMs: timings.associatedMs,
					respondedMs: timings.respondedMs,
					closedMs: elapsedSince(start),
				},
				abortedByUs,
				acceptedTransferSyntaxes,
				negotiated,
			})
		})
	})
	client.send(target.host, target.port, target.callingAeTitle, target.calledAeTitle, sendOptions(target, identity))
	signal?.addEventListener("abort", abortLocally, { once: true })

	return {
		client,
		markResponded: () => {
			timings.respondedMs = elapsedSince(start)
		},
		abort: abortLocally,
		isAssociated: () => associated,
		ended,
	}
}

// integrace-dicom.md 6.2
export function unopenedEnd(start: number): SessionEnd {
	return {
		association: {
			outcome: ASSOCIATION_OUTCOME.NOT_CONNECTED,
			timeout: undefined,
			rejection: undefined,
			abort: undefined,
			peerMaxPduLength: undefined,
			peerImplementationClassUid: undefined,
			peerImplementationVersionName: undefined,
		},
		timingsMs: {
			connectedMs: undefined,
			associatedMs: undefined,
			respondedMs: undefined,
			closedMs: elapsedSince(start),
		},
		abortedByUs: false,
		acceptedTransferSyntaxes: new Map(),
		negotiated: undefined,
	}
}
