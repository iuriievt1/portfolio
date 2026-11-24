import { performance } from "node:perf_hooks"
import { association, type Dataset, requests, type responses } from "@veevoy/dcmjs-dimse"
import {
	checkTarget,
	type ImplementationIdentity,
	openSession,
	type Session,
	type SessionEnd,
	unopenedEnd,
} from "./association-session"
import {
	type CapabilityReport,
	type DimseClient,
	type DimseTarget,
	type EchoResult,
	type FindQuery,
	type FindStream,
	type NegotiatedContext,
	NOT_SENT_REASON,
	type ProposedContext,
	type StoredArtifact,
	type StoreResult,
} from "./contract"
import { ForkFindStream } from "./find-stream"
import { type Answer, type Attempt, attemptOf, errorCommentOf, noAnswer, unsentAttempt } from "./phase"
import { echoClassification, storeClassification } from "./status-classes"
import { storedVariantsOf } from "./stored-artifact"

// PS3.5 9.1
const UID_PATTERN = /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))*$/
const MAX_UID_LENGTH = 64
// PS3.8 9.3.2.2
const MAX_PROPOSED_CONTEXTS = 128
const PLACEHOLDER_CONTEXT_ID = 1
// integrace-dicom.md 6.2, 8.3 (?)
const ECHO_DATASET_BYTES = 0

interface SentStore {
	request: requests.CStoreRequest
	variants: readonly Dataset[]
}

function isUid(value: string): boolean {
	return value.length <= MAX_UID_LENGTH && UID_PATTERN.test(value)
}

// integrace-dicom.md 6.1, PS3.8 9.3.2.2
function checkProposals(contexts: readonly ProposedContext[]): void {
	if (contexts.length === 0 || contexts.length > MAX_PROPOSED_CONTEXTS) {
		throw new RangeError(`a probe proposes 1 to ${MAX_PROPOSED_CONTEXTS} presentation contexts`)
	}
	for (const context of contexts) {
		const uids = [context.abstractSyntaxUid, ...context.transferSyntaxUids]
		if (context.transferSyntaxUids.length === 0 || !uids.every(isUid)) {
			throw new RangeError(`the presentation context of ${context.abstractSyntaxUid} is not a list of UIDs`)
		}
	}
}

function answerOf(request: requests.Request, session: Session): Answer {
	const answer = noAnswer()
	request.on("response", (response: responses.Response) => {
		answer.status = response.getStatus()
		answer.errorComment = errorCommentOf(response.getErrorComment())
		session.markResponded()
	})
	request.on("notSent", (reason: string) => {
		answer.forkNotSentReason = reason
	})
	return answer
}

// integrace-dicom.md 6.1
function capabilityReportOf(end: SessionEnd, proposals: readonly ProposedContext[]): CapabilityReport {
	const negotiated = end.negotiated?.getPresentationContexts() ?? []
	const contexts: NegotiatedContext[] = negotiated.map(({ id, context }, index) => ({
		id,
		abstractSyntaxUid: context.getAbstractSyntaxUid(),
		proposedTransferSyntaxUids: [...(proposals[index]?.transferSyntaxUids ?? [])],
		result: context.getResult(),
		acceptedTransferSyntaxUid: end.acceptedTransferSyntaxes.get(id),
	}))
	return { contexts, association: end.association, timingsMs: end.timingsMs }
}

// NAB-354, integrace-dicom.md 6.1, 8.3
function echoResultOf(end: SessionEnd, attempt: Attempt): EchoResult {
	return {
		phase: attempt.phase,
		notSentReason: attempt.notSentReason,
		statusHex: attempt.statusHex,
		errorComment: attempt.errorComment,
		association: end.association,
		classification: echoClassification(attempt),
		timingsMs: end.timingsMs,
	}
}

// integrace-dicom.md 6.2, 8.1, CAP-023-R15
function storeResultOf(end: SessionEnd, attempt: Attempt, sent: SentStore | undefined): StoreResult {
	const presentationContextId = sent?.request.getSelectedPresentationContextId()
	const acceptedTransferSyntax =
		presentationContextId === undefined ? undefined : end.acceptedTransferSyntaxes.get(presentationContextId)
	const selected = sent?.variants.find((variant) => variant.getTransferSyntaxUid() === acceptedTransferSyntax)
	const datasetBytesFlushed = sent?.request.getDatasetBytesSent() ?? 0
	return {
		phase: attempt.phase,
		notSentReason: attempt.notSentReason,
		datasetBytesFlushed,
		datasetSent: selected !== undefined && datasetBytesFlushed === selected.getStoredDataset().length,
		sentDatasetSha256: sent?.request.getSentDatasetSha256(),
		acceptedTransferSyntax,
		presentationContextId,
		statusHex: attempt.statusHex,
		errorComment: attempt.errorComment,
		association: end.association,
		classification: storeClassification(attempt),
		timingsMs: end.timingsMs,
	}
}

// integrace-dicom.md 6, ADR-003 ř. 29, ADR-017, ADR-005 ř. 38–39
export class ForkDimseClient implements DimseClient {
	constructor(private readonly identity: ImplementationIdentity) {}

	// NAB-354, integrace-dicom.md 6.1, 8.3
	async echo(target: DimseTarget, signal?: AbortSignal): Promise<EchoResult> {
		checkTarget(target)
		if (signal?.aborted) {
			return echoResultOf(unopenedEnd(performance.now()), unsentAttempt(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT))
		}
		const request = new requests.CEchoRequest()
		const session = openSession(target, this.identity, (client) => client.addRequest(request), signal)
		const answer = answerOf(request, session)
		const end = await session.ended
		return echoResultOf(end, attemptOf(end, answer, ECHO_DATASET_BYTES))
	}

	// integrace-dicom.md 6.1
	async probe(
		target: DimseTarget,
		contexts: readonly ProposedContext[],
		signal?: AbortSignal,
	): Promise<CapabilityReport> {
		checkTarget(target)
		checkProposals(contexts)
		if (signal?.aborted) {
			return capabilityReportOf(unopenedEnd(performance.now()), contexts)
		}
		const session = openSession(
			target,
			this.identity,
			(client) => {
				for (const proposal of contexts) {
					const context = new association.PresentationContext(PLACEHOLDER_CONTEXT_ID, proposal.abstractSyntaxUid)
					for (const transferSyntaxUid of proposal.transferSyntaxUids) {
						context.addTransferSyntaxUid(transferSyntaxUid)
					}
					client.addAdditionalPresentationContext(context, true)
				}
			},
			signal,
		)
		return capabilityReportOf(await session.ended, contexts)
	}

	// NAB-359, integrace-dicom.md 6.1, 6.2, 8.1, ADR-005 ř. 22, 23, 33
	async store(target: DimseTarget, artifact: StoredArtifact, signal?: AbortSignal): Promise<StoreResult> {
		checkTarget(target)
		const start = performance.now()
		if (signal?.aborted) {
			return storeResultOf(unopenedEnd(start), unsentAttempt(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT), undefined)
		}
		const variants = storedVariantsOf(artifact)
		if (variants === undefined) {
			return storeResultOf(unopenedEnd(start), unsentAttempt(NOT_SENT_REASON.ARTIFACT_INTEGRITY), undefined)
		}
		const request = new requests.CStoreRequest(variants)
		const session = openSession(target, this.identity, (client) => client.addRequest(request), signal)
		const answer = answerOf(request, session)
		const end = await session.ended
		return storeResultOf(end, attemptOf(end, answer, request.getDatasetBytesSent()), { request, variants })
	}

	// integrace-dicom.md 6.1, 6.3, 6.4, ADR-003 ř. 29
	find(target: DimseTarget, query: FindQuery, signal?: AbortSignal): FindStream {
		checkTarget(target)
		return new ForkFindStream(target, query, this.identity, signal)
	}
}
