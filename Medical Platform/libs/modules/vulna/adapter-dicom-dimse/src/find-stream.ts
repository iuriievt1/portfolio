import { performance } from "node:perf_hooks"
import { constants, Dataset, requests, type responses } from "@veevoy/dcmjs-dimse"
import {
	type ImplementationIdentity,
	openSession,
	type Session,
	type SessionEnd,
	unopenedEnd,
} from "./association-session"
import {
	CANCEL_REASON,
	type CancelReason,
	type DimseTarget,
	type FindFinal,
	type FindMatch,
	type FindQuery,
	type FindStream,
	INFORMATION_MODEL,
	type InformationModel,
	NOT_SENT_REASON,
	OUTCOME_CLASS,
} from "./contract"
import { identifierJsonOf } from "./identifier-json"
import { type Attempt, attemptOf, errorCommentOf, noAnswer, statusHexOf, unsentAttempt } from "./phase"
import { findClassification } from "./status-classes"

// konfigurace-a-profily.md 2.7, integrace-dicom.md 6.3, ADR-003 ř. 29 (?) ⚠ Q-016
export const DEFAULT_MAX_MATCHES = 1000
export const DEFAULT_HIGH_WATER_MARK = 64
export const DEFAULT_CONSUMER_STALL_MS = 60_000
export const DEFAULT_CANCEL_GRACE_MS = 5000
// integrace-dicom.md 6.3
const RESUME_DIVISOR = 4

// PS3.4 C.4.1.1.4, integrace-dicom.md 8.2
const PENDING_STATUSES: ReadonlySet<number> = new Set([constants.Status.Pending, constants.Status.PendingWarning])

// integrace-dicom.md 5.7, 5.8, 10, NAB-388, NAB-389, TS-148
const UTF8_CHARACTER_SET = "ISO_IR 192"

// PS3.4 C.3.1, ADR-003 ř. 29
const PATIENT_ROOT_FIND = "1.2.840.10008.5.1.4.1.2.1.1"

// PS3.4 C.3.1, C.3.2, K.6, ADR-003 ř. 29
const FIND_SOP_CLASSES: Readonly<Record<InformationModel, string>> = {
	[INFORMATION_MODEL.PATIENT_ROOT]: PATIENT_ROOT_FIND,
	[INFORMATION_MODEL.STUDY_ROOT]: constants.SopClass.StudyRootQueryRetrieveInformationModelFind,
	[INFORMATION_MODEL.MODALITY_WORKLIST]: constants.SopClass.ModalityWorklistInformationModelFind,
}

// integrace-dicom.md 6.4 (?)
const DELIVERED_AFTER_CANCEL: ReadonlySet<CancelReason> = new Set([CANCEL_REASON.CALLER])

const DONE: IteratorReturnResult<undefined> = { value: undefined, done: true }

interface Limits {
	maxMatches: number
	highWaterMark: number
	consumerStallMs: number
	cancelGraceMs: number
}

function positiveIntegerOr(value: number | undefined, fallback: number, name: string): number {
	const chosen = value ?? fallback
	if (!Number.isInteger(chosen) || chosen < 1) {
		throw new RangeError(`the ${name} of a query must be a positive integer`)
	}
	return chosen
}

function limitsOf(query: FindQuery): Limits {
	return {
		maxMatches: positiveIntegerOr(query.maxMatches, DEFAULT_MAX_MATCHES, "maxMatches"),
		highWaterMark: positiveIntegerOr(query.highWaterMark, DEFAULT_HIGH_WATER_MARK, "highWaterMark"),
		consumerStallMs: positiveIntegerOr(query.consumerStallMs, DEFAULT_CONSUMER_STALL_MS, "consumerStallMs"),
		cancelGraceMs: positiveIntegerOr(query.cancelGraceMs, DEFAULT_CANCEL_GRACE_MS, "cancelGraceMs"),
	}
}

export function findRequestOf(query: FindQuery): requests.CFindRequest {
	const sopClassUid = FIND_SOP_CLASSES[query.informationModel]
	if (sopClassUid === undefined) {
		throw new RangeError(`the information model ${String(query.informationModel)} is not one the adapter queries`)
	}
	const request = new requests.CFindRequest()
	request.setAffectedSopClassUid(sopClassUid)
	request.setDataset(new Dataset({ ...query.identifier, SpecificCharacterSet: UTF8_CHARACTER_SET }))
	return request
}

// integrace-dicom.md 6.1, 6.3, 6.4, 8.2, ADR-003 ř. 29, ADR-005 ř. 39
export class ForkFindStream implements FindStream {
	readonly result: Promise<FindFinal>
	private resolveResult: (final: FindFinal) => void = () => undefined
	private readonly limits: Limits
	private readonly informationModel: InformationModel
	private readonly request: requests.CFindRequest
	private readonly start = performance.now()
	private readonly answer = noAnswer()
	private session: Session | undefined
	private readonly queue: FindMatch[] = []
	private readonly waiting: ((next: IteratorResult<FindMatch>) => void)[] = []
	private iterationEnded = false
	private consumerGone = false
	private paused = false
	private matches = 0
	private matchesAfterCancel = 0
	private droppedAfterCancel = 0
	private maxQueued = 0
	private cancelReason: CancelReason | undefined
	private stallTimer: NodeJS.Timeout | undefined
	private cancelGraceTimer: NodeJS.Timeout | undefined

	constructor(
		target: DimseTarget,
		query: FindQuery,
		identity: ImplementationIdentity,
		private readonly signal: AbortSignal | undefined,
		open: typeof openSession = openSession,
	) {
		this.limits = limitsOf(query)
		this.informationModel = query.informationModel
		this.request = findRequestOf(query)
		this.result = new Promise((resolve) => {
			this.resolveResult = resolve
		})
		if (signal?.aborted) {
			this.cancelReason = CANCEL_REASON.SIGNAL
			this.endIteration()
			this.resolveResult(this.finalOf(unopenedEnd(this.start), unsentAttempt(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)))
			return
		}
		this.request.on("response", (response: responses.Response) => this.onResponse(response))
		this.request.on("notSent", (reason: string) => {
			this.answer.forkNotSentReason = reason
		})
		this.session = open(target, identity, (client) => client.addRequest(this.request), undefined)
		signal?.addEventListener("abort", this.onSignal, { once: true })
		void this.session.ended.then((end) => this.onEnded(end))
	}

	[Symbol.asyncIterator](): AsyncIterator<FindMatch> {
		return {
			next: () => this.next(),
			return: () => this.returnEarly(),
		}
	}

	cancel(): void {
		this.requestCancel(CANCEL_REASON.CALLER)
	}

	private readonly onSignal = () => {
		this.requestCancel(CANCEL_REASON.SIGNAL)
	}

	private next(): Promise<IteratorResult<FindMatch>> {
		const match = this.queue.shift()
		if (match !== undefined) {
			this.afterTake()
			return Promise.resolve({ value: match, done: false })
		}
		if (this.iterationEnded) {
			return Promise.resolve(DONE)
		}
		return new Promise((resolve) => {
			this.waiting.push(resolve)
		})
	}

	private returnEarly(): Promise<IteratorResult<FindMatch>> {
		this.consumerGone = true
		this.queue.length = 0
		this.requestCancel(CANCEL_REASON.ITERATOR_RETURN)
		this.endIteration()
		return Promise.resolve(DONE)
	}

	private isAnswered(): boolean {
		return this.answer.status !== undefined
	}

	private onResponse(response: responses.Response): void {
		const status = response.getStatus()
		if (!PENDING_STATUSES.has(status)) {
			this.answer.status = status
			this.answer.errorComment = errorCommentOf(response.getErrorComment())
			this.session?.markResponded()
			this.clearCancelGraceTimer()
			this.clearStallTimer()
			this.resumeIfPaused()
			this.endIteration()
			return
		}
		if (this.cancelReason === undefined && this.matches >= this.limits.maxMatches) {
			this.requestCancel(CANCEL_REASON.MAX_MATCHES)
		}
		const cancelReason = this.cancelReason
		if (cancelReason === undefined) {
			this.matches += 1
			this.enqueue(this.matchOf(response, false))
			return
		}
		this.matchesAfterCancel += 1
		const isDelivered =
			!this.consumerGone && DELIVERED_AFTER_CANCEL.has(cancelReason) && this.queue.length < this.limits.highWaterMark
		if (!isDelivered) {
			this.droppedAfterCancel += 1
			return
		}
		this.enqueue(this.matchOf(response, true))
	}

	private matchOf(response: responses.Response, isAfterCancel: boolean): FindMatch {
		const dataset = response.getDataset()
		const received = dataset?.getReceivedSpecificCharacterSet()
		return {
			statusHex: statusHexOf(response.getStatus()),
			identifier: identifierJsonOf(dataset?.getElements() ?? {}),
			specificCharacterSet: received,
			characterSetMissing: received === undefined || received.length === 0,
			afterCancel: isAfterCancel,
		}
	}

	// integrace-dicom.md 6.3, PS3.8 9.3.5
	private enqueue(match: FindMatch): void {
		const waiting = this.waiting.shift()
		if (waiting !== undefined) {
			waiting({ value: match, done: false })
			return
		}
		this.queue.push(match)
		this.maxQueued = Math.max(this.maxQueued, this.queue.length)
		if (this.queue.length >= this.limits.highWaterMark && this.cancelReason === undefined && !this.paused) {
			this.paused = true
			this.session?.client.pauseReceiving()
		}
		this.startStallTimer()
	}

	private afterTake(): void {
		this.clearStallTimer()
		if (this.paused && this.queue.length <= Math.floor(this.limits.highWaterMark / RESUME_DIVISOR)) {
			this.resumeIfPaused()
		}
		this.startStallTimer()
	}

	private startStallTimer(): void {
		const isWaitingForConsumer = this.queue.length > 0 && this.cancelReason === undefined && !this.iterationEnded
		if (this.stallTimer !== undefined || !isWaitingForConsumer) {
			return
		}
		this.stallTimer = setTimeout(() => {
			this.stallTimer = undefined
			this.requestCancel(CANCEL_REASON.CONSUMER_STALL)
		}, this.limits.consumerStallMs)
	}

	private clearStallTimer(): void {
		clearTimeout(this.stallTimer)
		this.stallTimer = undefined
	}

	private clearCancelGraceTimer(): void {
		clearTimeout(this.cancelGraceTimer)
		this.cancelGraceTimer = undefined
	}

	private resumeIfPaused(): void {
		if (!this.paused) {
			return
		}
		this.paused = false
		this.session?.client.resumeReceiving()
	}

	private requestCancel(reason: CancelReason): void {
		if (this.cancelReason !== undefined || this.isAnswered() || this.session === undefined) {
			return
		}
		this.cancelReason = reason
		this.clearStallTimer()
		if (!this.session.isAssociated() || this.request.getCommandBytesSent() === 0) {
			this.session.abort()
			return
		}
		this.cancelGraceTimer = setTimeout(() => {
			this.cancelGraceTimer = undefined
			this.session?.abort()
		}, this.limits.cancelGraceMs)
		this.session.client.cancel(this.request)
		this.resumeIfPaused()
	}

	private endIteration(): void {
		this.iterationEnded = true
		for (const waiting of this.waiting.splice(0)) {
			waiting(DONE)
		}
	}

	private onEnded(end: SessionEnd): void {
		this.signal?.removeEventListener("abort", this.onSignal)
		this.clearStallTimer()
		this.clearCancelGraceTimer()
		this.endIteration()
		this.resolveResult(this.finalOf(end, attemptOf(end, this.answer, this.request.getCommandBytesSent())))
	}

	private finalOf(end: SessionEnd, attempt: Attempt): FindFinal {
		const isCancelled = this.cancelReason !== undefined
		const classification = findClassification(attempt, this.informationModel, isCancelled)
		return {
			phase: attempt.phase,
			notSentReason: attempt.notSentReason,
			statusHex: attempt.statusHex,
			errorComment: attempt.errorComment,
			complete: classification.outcomeClass === OUTCOME_CLASS.SUCCESS,
			matches: this.matches,
			matchesAfterCancel: this.matchesAfterCancel,
			droppedAfterCancel: this.droppedAfterCancel,
			maxQueued: this.maxQueued,
			cancelRequested: isCancelled,
			cancelReason: this.cancelReason,
			association: end.association,
			classification,
			timingsMs: end.timingsMs,
		}
	}
}
