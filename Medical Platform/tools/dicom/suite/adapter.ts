import { createHash, randomInt } from "node:crypto"
import { readFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"
import {
	ASSOCIATION_OUTCOME,
	CANCEL_REASON,
	type Classification,
	DIMSE_PHASE,
	type DimseTarget,
	type FindFinal,
	type FindMatch,
	type FindQuery,
	ForkDimseClient,
	INFORMATION_MODEL,
	type StoredArtifact,
} from "@ansora/vulna-adapter-dicom-dimse"
import { Dataset } from "@veevoy/dcmjs-dimse"
import { COMMAND_FIELD, STATUS } from "../dimse"
import { PRESENTATION_CONTEXT_RESULT } from "../pdu"
import { CLIENT_IMPLEMENTATION_CLASS_UID, SYNTHETIC_PATIENT_ID } from "../synthetic"
import { IMPLICIT_VR_LITTLE_ENDIAN, VERIFICATION } from "../uids"
import { hexWord, type WireMessage } from "../wire/recorder"
import { type DicomTarget, PEERS } from "./peers"
import {
	ECHO_SUCCESS_GOLDEN,
	FIND_CANCELLED_GOLDEN,
	FIND_GOLDEN,
	FIND_NO_FINAL_RESPONSE_GOLDEN,
	FIND_SUCCESS_GOLDEN,
	findScenario,
	type GoldenRejection,
	REJECTION_GOLDEN,
	rejectScenario,
	STORE_GOLDEN,
	STORE_SUCCESS_GOLDEN,
	STORE_UNKNOWN_GOLDEN,
	storeScenario,
	WORKLIST_NOT_AUTHORIZED,
} from "./status-golden"
import { readWireConnections, type WireConnection } from "./wire-records"

// integrace-dicom.md 6, 8, 11, ADR-003 ř. 29, ADR-017

const SMOKE_PHOTOGRAPH = "/data/smoke/photograph.dcm"
const SMOKE_DOCUMENT = "/data/smoke/document.dcm"
const REPETITIONS = 3
const CANCEL_AFTER_MATCHES = 2
const SLOW_HIGH_WATER_MARK = 2
const SLOW_CONSUMER_MS = 20
const SHORT_TIMEOUTS = { acseMs: 5000, dimseMs: 5000 }
const STORE_ABORT_SCENARIO = "STORE-ABORT"
const FIND_ABORT_SCENARIO = "FIND-ABORT"
const HOSTILE_STORE_ABORT_SCENARIO = "ABORT-AFTER-DATA"
const HOSTILE_FIND_ABORT_SCENARIO = "FIND-NO-FINAL"
const PROBED_AE_TITLES = ["STORESCP", "AMIS", "DCM4CHEE"]
const QUERIED_STUDY_AE_TITLES = ["DCMQRSCP", "AMIS"]
const QUERIED_WORKLIST_AE_TITLES = ["WLMSCPFS", "AMIS"]
const CANCELLED_AE_TITLES = ["AMIS", "WLMSCPFS"]
const ARCHIVE_AE_TITLE = "DCM4CHEE"
const EMULATOR_AE_TITLE = "AMIS"
const HOSTILE_AE_TITLE = "BASELINE"

// PS3.10 7.1, PS3.5 7.1.2
const PART10_PREAMBLE_LENGTH = 128
const PART10_PREFIX = "DICM"
const META_GROUP = 0x00_02
const META_TAG = { SOP_CLASS: 0x00_02, SOP_INSTANCE: 0x00_03, TRANSFER_SYNTAX: 0x00_10 } as const
const ELEMENT_FIELD = { GROUP: 0, ELEMENT: 2, VR: 4, SHORT_LENGTH: 6, LONG_LENGTH: 8 } as const
const VR_LENGTH = 2
const SHORT_HEADER_LENGTH = 8
const LONG_HEADER_LENGTH = 12
const GROUP_LENGTH_ELEMENT_LENGTH = 12
const LONG_LENGTH_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"])
const UID_PADDING = /[\0 ]+$/
const UID_ROOT = "2.25."
const DECIMAL_DIGITS = 10

const ECHO_REQUEST = hexWord(COMMAND_FIELD.C_ECHO_RQ)
const ECHO_RESPONSE = hexWord(COMMAND_FIELD.C_ECHO_RSP)
const STORE_REQUEST = hexWord(COMMAND_FIELD.C_STORE_RQ)
const STORE_RESPONSE = hexWord(COMMAND_FIELD.C_STORE_RSP)
const FIND_RESPONSE = hexWord(COMMAND_FIELD.C_FIND_RSP)
const CANCEL_REQUEST = hexWord(COMMAND_FIELD.C_CANCEL_RQ)
const PENDING = new Set([hexWord(STATUS.PENDING), hexWord(STATUS.PENDING_WARNING)])
const SUCCESS_HEX = hexWord(STATUS.SUCCESS)
const CANCEL_HEX = hexWord(STATUS.CANCEL)

interface Part10Meta {
	sopClassUid: string
	sopInstanceUid: string
	transferSyntaxUid: string
	datasetOffset: number
}

// PS3.10 7.1
export function metaOf(part10: Buffer): Part10Meta {
	const groupStart = PART10_PREAMBLE_LENGTH + PART10_PREFIX.length
	if (part10.toString("latin1", PART10_PREAMBLE_LENGTH, groupStart) !== PART10_PREFIX) {
		throw new Error("not a part10 file")
	}
	const groupLength = part10.readUInt32LE(groupStart + ELEMENT_FIELD.LONG_LENGTH)
	const datasetOffset = groupStart + GROUP_LENGTH_ELEMENT_LENGTH + groupLength
	const values = new Map<number, string>()
	let offset = groupStart + GROUP_LENGTH_ELEMENT_LENGTH
	while (offset < datasetOffset) {
		const group = part10.readUInt16LE(offset + ELEMENT_FIELD.GROUP)
		const element = part10.readUInt16LE(offset + ELEMENT_FIELD.ELEMENT)
		const vr = part10.toString("latin1", offset + ELEMENT_FIELD.VR, offset + ELEMENT_FIELD.VR + VR_LENGTH)
		const isLong = LONG_LENGTH_VRS.has(vr)
		const length = isLong
			? part10.readUInt32LE(offset + ELEMENT_FIELD.LONG_LENGTH)
			: part10.readUInt16LE(offset + ELEMENT_FIELD.SHORT_LENGTH)
		const valueStart = offset + (isLong ? LONG_HEADER_LENGTH : SHORT_HEADER_LENGTH)
		if (group === META_GROUP) {
			values.set(element, part10.toString("latin1", valueStart, valueStart + length).replace(UID_PADDING, ""))
		}
		offset = valueStart + length
	}
	return {
		sopClassUid: values.get(META_TAG.SOP_CLASS) ?? "",
		sopInstanceUid: values.get(META_TAG.SOP_INSTANCE) ?? "",
		transferSyntaxUid: values.get(META_TAG.TRANSFER_SYNTAX) ?? "",
		datasetOffset,
	}
}

function uidOfLength(length: number): string {
	const digits = Array.from({ length: length - UID_ROOT.length }, (_, index) =>
		index === 0 ? randomInt(1, DECIMAL_DIGITS) : randomInt(0, DECIMAL_DIGITS),
	).join("")
	return `${UID_ROOT}${digits}`
}

// PS3.5 9.1
export function renewed(part10: Buffer): Buffer {
	const meta = metaOf(part10)
	const dataset = new Dataset(part10.subarray(meta.datasetOffset), meta.transferSyntaxUid)
	const uids = new Set(
		[
			meta.sopInstanceUid,
			...["StudyInstanceUID", "SeriesInstanceUID", "SOPInstanceUID"].map((keyword) =>
				String(dataset.getElement(keyword) ?? ""),
			),
		].filter((uid) => uid.startsWith(UID_ROOT)),
	)
	const renewedUids = new Map([...uids].map((uid) => [uid, uidOfLength(uid.length)]))
	const alternatives = [...uids].sort((a, b) => b.length - a.length).map((uid) => uid.replaceAll(".", "\\."))
	const exactUid = new RegExp(`(?<![0-9.])(${alternatives.join("|")})(?![0-9])`, "g")
	const text = part10.toString("latin1").replace(exactUid, (uid) => renewedUids.get(uid) ?? uid)
	return Buffer.from(text, "latin1")
}

export interface SmokeArtifact {
	artifact: StoredArtifact
	stored: Buffer
	studyInstanceUid: string
}

function smokeArtifact(path: string): SmokeArtifact {
	const part10 = renewed(readFileSync(path))
	const meta = metaOf(part10)
	const stored = part10.subarray(meta.datasetOffset)
	const studyInstanceUid = new Dataset(stored, meta.transferSyntaxUid).getElement("StudyInstanceUID") ?? ""
	return {
		artifact: {
			sopClassUid: meta.sopClassUid,
			sopInstanceUid: meta.sopInstanceUid,
			variants: [{ transferSyntaxUid: meta.transferSyntaxUid, part10, datasetSha256: sha256(stored) }],
		},
		stored,
		studyInstanceUid: String(studyInstanceUid),
	}
}

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex")
}

export interface AdapterCase {
	name: string
	peer: string
	result: "pass" | "fail"
	reason?: string
	statusHex?: string
	classification?: Classification
}

export interface Expectation {
	name: string
	peer: string
	calledAeTitle: string
	check: (wire: WireConnection) => string | undefined
	reason: string | undefined
	statusHex: string | undefined
	classification: Classification | undefined
}

interface StoreCheck {
	calledAeTitle?: string
	expected?: Classification
	isAborted?: boolean
}

interface FindCheck {
	calledAeTitle?: string
	expected?: Classification
	exactMatches?: number
}

function classificationProblem(actual: Classification, expected: Classification): string | undefined {
	return isDeepStrictEqual(actual, expected)
		? undefined
		: `classified as ${actual.outcomeClass} by ${actual.ruleId}, not ${expected.outcomeClass} by ${expected.ruleId}`
}

function responses(wire: WireConnection, commandField: string): WireMessage[] {
	return wire.messages.filter(
		(message) => message.direction === "peer-to-client" && message.command?.commandField === commandField,
	)
}

function lastStatus(wire: WireConnection, commandField: string): string | undefined {
	return responses(wire, commandField).at(-1)?.command?.statusHex
}

// PS3.4 C.4.1.1.4
export function finalFindStatus(wire: WireConnection): string | undefined {
	return responses(wire, FIND_RESPONSE)
		.filter((message) => !PENDING.has(message.command?.statusHex ?? ""))
		.at(-1)?.command?.statusHex
}

function pendingCount(wire: WireConnection): number {
	return responses(wire, FIND_RESPONSE).filter((message) => PENDING.has(message.command?.statusHex ?? "")).length
}

function studyQuery(extra: Partial<FindQuery> = {}): FindQuery {
	return {
		informationModel: INFORMATION_MODEL.STUDY_ROOT,
		identifier: { QueryRetrieveLevel: "STUDY", PatientID: SYNTHETIC_PATIENT_ID, StudyInstanceUID: "", PatientName: "" },
		...extra,
	}
}

function worklistQuery(extra: Partial<FindQuery> = {}): FindQuery {
	return {
		informationModel: INFORMATION_MODEL.MODALITY_WORKLIST,
		identifier: {
			PatientName: "",
			PatientID: "",
			AccessionNumber: "",
			ScheduledProcedureStepSequence: [{ Modality: "XC", ScheduledProcedureStepDescription: "" }],
		},
		...extra,
	}
}

// ADR-003 ř. 29, integrace-dicom.md 6.4, 8.2
export function cancelProblem(final: FindFinal, matches: number): string | undefined {
	if (final.cancelReason !== CANCEL_REASON.MAX_MATCHES || matches !== CANCEL_AFTER_MATCHES) {
		return `cancel ${final.cancelReason} after ${matches} matches`
	}
	const expected = CANCELLED_CLASSIFICATIONS.get(final.statusHex ?? "")
	if (final.phase !== DIMSE_PHASE.RESPONSE || expected === undefined) {
		return `ended as ${final.phase} ${final.statusHex}`
	}
	if (final.complete || final.droppedAfterCancel !== final.matchesAfterCancel) {
		return `complete ${final.complete}, ${final.droppedAfterCancel} of ${final.matchesAfterCancel} dropped`
	}
	return classificationProblem(final.classification, expected)
}

const CANCELLED_CLASSIFICATIONS: ReadonlyMap<string, Classification> = new Map([
	[SUCCESS_HEX, FIND_CANCELLED_GOLDEN],
	[CANCEL_HEX, FIND_GOLDEN.find(({ status }) => status === STATUS.CANCEL)?.classification ?? FIND_CANCELLED_GOLDEN],
])

// integrace-dicom.md 9.1, 11.1
export function confirmed(expectations: readonly Expectation[], connectionsOf: (peer: string) => WireConnection[]) {
	const unconsumed = new Map<string, WireConnection[]>()
	const cases: AdapterCase[] = expectations.map((expectation) => {
		if (!unconsumed.has(expectation.peer)) {
			unconsumed.set(
				expectation.peer,
				connectionsOf(expectation.peer).sort((a, b) => a.connection - b.connection),
			)
		}
		const connections = unconsumed.get(expectation.peer) ?? []
		const index = connections.findIndex(
			(connection) => connection.association.request?.calledAeTitle === expectation.calledAeTitle,
		)
		const [wire] = index === -1 ? [] : connections.splice(index, 1)
		const reason =
			expectation.reason ??
			(wire === undefined ? `no connection to ${expectation.calledAeTitle} on the wire` : expectation.check(wire))
		return {
			name: expectation.name,
			peer: expectation.peer,
			result: reason === undefined ? "pass" : "fail",
			...(reason === undefined ? {} : { reason }),
			...(expectation.statusHex === undefined ? {} : { statusHex: expectation.statusHex }),
			...(expectation.classification === undefined ? {} : { classification: expectation.classification }),
		}
	})
	const leftovers: AdapterCase[] = [...unconsumed]
		.filter(([, connections]) => connections.length > 0)
		.map(([peer, connections]) => ({
			name: `wire ${peer}`,
			peer,
			result: "fail",
			reason: `${connections.length} connections on the wire without an operation`,
		}))
	return [...cases, ...leftovers]
}

// integrace-dicom.md 6, 8, 11
export class AdapterChecks {
	private readonly client = new ForkDimseClient({ implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID })
	private readonly expectations: Expectation[] = []

	constructor(
		private readonly targets: readonly DicomTarget[],
		private readonly callingAeTitle: string,
	) {}

	private target(aeTitle: string, calledAeTitle = aeTitle, extra: Partial<DimseTarget> = {}): DimseTarget {
		const found = this.targets.find((target) => target.aeTitle === aeTitle)
		if (found === undefined) {
			throw new Error(`no peer ${aeTitle} in the suite`)
		}
		return { host: found.host, port: found.port, callingAeTitle: this.callingAeTitle, calledAeTitle, ...extra }
	}

	private peerOf(aeTitle: string): string {
		return this.targets.find((target) => target.aeTitle === aeTitle)?.peer ?? aeTitle
	}

	private expect(
		aeTitle: string,
		expectation: Omit<Expectation, "peer" | "calledAeTitle"> & { calledAeTitle?: string },
	): void {
		this.expectations.push({
			...expectation,
			peer: this.peerOf(aeTitle),
			calledAeTitle: expectation.calledAeTitle ?? aeTitle,
		})
	}

	// NAB-354, integrace-dicom.md 6.1, 8.3
	async echo(aeTitle: string): Promise<void> {
		const result = await this.client.echo(this.target(aeTitle))
		this.expect(aeTitle, {
			name: `echo ${aeTitle}`,
			reason: classificationProblem(result.classification, ECHO_SUCCESS_GOLDEN),
			statusHex: result.statusHex,
			classification: result.classification,
			check: (wire) => {
				const proposed = wire.association.request?.presentationContexts.map((context) => context.transferSyntaxes)
				if (!isDeepStrictEqual(proposed, [[IMPLICIT_VR_LITTLE_ENDIAN]])) {
					return `proposed ${JSON.stringify(proposed)}`
				}
				const requests = wire.messages.filter((message) => message.command?.commandField === ECHO_REQUEST).length
				const status = lastStatus(wire, ECHO_RESPONSE)
				return requests === 1 && status === result.statusHex ? undefined : `wire status ${status}, ${requests} requests`
			},
		})
	}

	// integrace-dicom.md 6.1
	async probe(aeTitle: string, smoke: readonly SmokeArtifact[]): Promise<void> {
		const contexts = [
			{ abstractSyntaxUid: VERIFICATION, transferSyntaxUids: [IMPLICIT_VR_LITTLE_ENDIAN] },
			...smoke.map(({ artifact }) => ({
				abstractSyntaxUid: artifact.sopClassUid,
				transferSyntaxUids: artifact.variants.map((variant) => variant.transferSyntaxUid),
			})),
		]
		const report = await this.client.probe(this.target(aeTitle), contexts)
		const accepted = report.contexts.filter((context) => context.acceptedTransferSyntaxUid !== undefined)
		this.expect(aeTitle, {
			name: `probe ${aeTitle}`,
			reason:
				report.association.outcome !== ASSOCIATION_OUTCOME.RELEASED || accepted.length === 0
					? `ended as ${report.association.outcome} with ${accepted.length} accepted contexts`
					: undefined,
			statusHex: undefined,
			classification: undefined,
			check: (wire) => {
				if (wire.messages.length > 0) {
					return "data went on the wire"
				}
				const wireAccepted = (wire.association.accept?.presentationContexts ?? [])
					.filter((context) => context.result === PRESENTATION_CONTEXT_RESULT.ACCEPTANCE)
					.map((context) => [context.id, context.transferSyntax])
				const reported = accepted.map((context) => [context.id, context.acceptedTransferSyntaxUid])
				return isDeepStrictEqual(reported, wireAccepted) ? undefined : `reported ${JSON.stringify(reported)}`
			},
		})
	}

	// NAB-359, integrace-dicom.md 6.2, 9.1, ADR-005 ř. 23
	async store(aeTitle: string, smoke: SmokeArtifact, options: StoreCheck = {}): Promise<void> {
		const calledAeTitle = options.calledAeTitle ?? aeTitle
		const expected = options.expected ?? STORE_SUCCESS_GOLDEN
		const result = await this.client.store(
			this.target(aeTitle, calledAeTitle, { timeouts: SHORT_TIMEOUTS }),
			smoke.artifact,
		)
		const sentStored =
			options.isAborted === true || result.sentDatasetSha256 === smoke.artifact.variants[0]?.datasetSha256
		this.expect(aeTitle, {
			name: `store ${calledAeTitle}@${aeTitle}`,
			calledAeTitle,
			reason:
				classificationProblem(result.classification, expected) ??
				(sentStored ? undefined : "sent bytes are not the stored ones"),
			statusHex: result.statusHex,
			classification: result.classification,
			check: (wire) => {
				if (options.isAborted === true) {
					return result.phase === DIMSE_PHASE.UNKNOWN && wire.association.abort?.by === "peer-to-client"
						? undefined
						: `phase ${result.phase}, abort ${JSON.stringify(wire.association.abort)}`
				}
				const sent = wire.messages.find((message) => message.command?.commandField === STORE_REQUEST)
				if (sent?.dataset?.sha256 !== sha256(smoke.stored) || sent.dataset.sha256 !== result.sentDatasetSha256) {
					return "the bytes on the wire are not the stored ones"
				}
				const status = lastStatus(wire, STORE_RESPONSE)
				return status === result.statusHex ? undefined : `wire status ${status}`
			},
		})
	}

	// integrace-dicom.md 6.4, 8.2
	async find(aeTitle: string, query: FindQuery, options: FindCheck = {}): Promise<void> {
		const calledAeTitle = options.calledAeTitle ?? aeTitle
		const expected = options.expected ?? FIND_SUCCESS_GOLDEN
		const stream = this.client.find(this.target(aeTitle, calledAeTitle, { timeouts: SHORT_TIMEOUTS }), query)
		const matches = await drain(stream)
		const final = await stream.result
		const problems = [
			classificationProblem(final.classification, expected),
			options.exactMatches !== undefined && matches !== options.exactMatches
				? `${matches} matches, not ${options.exactMatches}`
				: undefined,
			matches === final.matches ? undefined : `${matches} taken, ${final.matches} counted`,
		].filter((problem) => problem !== undefined)
		this.expect(aeTitle, {
			name: `find ${calledAeTitle}@${aeTitle} ${query.informationModel}`,
			calledAeTitle,
			reason: problems[0],
			statusHex: final.statusHex,
			classification: final.classification,
			check: (wire) => {
				if (pendingCount(wire) !== matches) {
					return `${pendingCount(wire)} pending responses on the wire, ${matches} matches`
				}
				const wireFinal = finalFindStatus(wire)
				return wireFinal === final.statusHex ? undefined : `final status ${wireFinal} on the wire, ${final.statusHex}`
			},
		})
	}

	// ADR-003 ř. 29, integrace-dicom.md 6.3, 6.4
	async cancel(aeTitle: string): Promise<void> {
		const stream = this.client.find(this.target(aeTitle), worklistQuery({ maxMatches: CANCEL_AFTER_MATCHES }))
		const matches = await drain(stream)
		const final = await stream.result
		this.expect(aeTitle, {
			name: `cancel ${aeTitle}`,
			reason: cancelProblem(final, matches),
			statusHex: final.statusHex,
			classification: final.classification,
			check: (wire) => {
				const cancels = wire.messages.filter(
					(message) => message.direction === "client-to-peer" && message.command?.commandField === CANCEL_REQUEST,
				).length
				if (cancels !== 1) {
					return `${cancels} C-CANCEL on the wire`
				}
				if (finalFindStatus(wire) !== final.statusHex) {
					return `final status ${finalFindStatus(wire)} on the wire, ${final.statusHex}`
				}
				const counted = final.matches + final.matchesAfterCancel
				return pendingCount(wire) === counted
					? undefined
					: `${pendingCount(wire)} pending on the wire, ${counted} counted`
			},
		})
	}

	// integrace-dicom.md 6.3
	async backpressure(aeTitle: string): Promise<void> {
		const stream = this.client.find(this.target(aeTitle), worklistQuery({ highWaterMark: SLOW_HIGH_WATER_MARK }))
		const matches = await drain(stream, SLOW_CONSUMER_MS)
		const final = await stream.result
		this.expect(aeTitle, {
			name: `backpressure ${aeTitle}`,
			reason:
				final.maxQueued > SLOW_HIGH_WATER_MARK || !final.complete
					? `${final.maxQueued} queued, complete ${final.complete}`
					: undefined,
			statusHex: final.statusHex,
			classification: final.classification,
			check: (wire) =>
				pendingCount(wire) === matches ? undefined : `${pendingCount(wire)} pending on the wire, ${matches} taken`,
		})
	}

	// integrace-dicom.md 8.3, PS3.8 9.3.4
	async reject(aeTitle: string, rejection: GoldenRejection): Promise<void> {
		const calledAeTitle = rejectScenario(rejection)
		const result = await this.client.echo(this.target(aeTitle, calledAeTitle))
		const expected = { result: rejection.result, source: rejection.source, reason: rejection.reason }
		this.expect(aeTitle, {
			name: `reject ${calledAeTitle}@${aeTitle}`,
			calledAeTitle,
			reason: classificationProblem(result.classification, rejection.classification),
			statusHex: undefined,
			classification: result.classification,
			check: (wire) =>
				isDeepStrictEqual(wire.association.reject, expected)
					? undefined
					: `wire reject ${JSON.stringify(wire.association.reject)}`,
		})
	}

	async golden(aeTitle: string, smokePath: string): Promise<void> {
		for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
			for (const { status, classification } of STORE_GOLDEN) {
				await this.store(aeTitle, smokeArtifact(smokePath), {
					calledAeTitle: storeScenario(status),
					expected: classification,
				})
			}
			for (const { status, classification } of FIND_GOLDEN) {
				await this.find(aeTitle, studyQuery(), { calledAeTitle: findScenario(status), expected: classification })
			}
			await this.find(aeTitle, worklistQuery(), {
				calledAeTitle: findScenario(WORKLIST_NOT_AUTHORIZED.status),
				expected: WORKLIST_NOT_AUTHORIZED.classification,
			})
			for (const rejection of REJECTION_GOLDEN) {
				await this.reject(aeTitle, rejection)
			}
		}
	}

	async aborts(aeTitle: string, storeAbort: string, findAbort: string, smokePath: string): Promise<void> {
		await this.store(aeTitle, smokeArtifact(smokePath), {
			calledAeTitle: storeAbort,
			expected: STORE_UNKNOWN_GOLDEN,
			isAborted: true,
		})
		await this.find(aeTitle, studyQuery(), { calledAeTitle: findAbort, expected: FIND_NO_FINAL_RESPONSE_GOLDEN })
	}

	// integrace-dicom.md 9.1, 11.1
	confirm(wireEvidence: string): AdapterCase[] {
		return confirmed(this.expectations, (peer) => readWireConnections(wireEvidence, peer))
	}
}

async function drain(stream: AsyncIterable<FindMatch>, pauseMs = 0): Promise<number> {
	let count = 0
	for await (const _ of stream) {
		count += 1
		if (pauseMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, pauseMs))
		}
	}
	return count
}

// integrace-dicom.md 6, 8, 11, ADR-003 ř. 29, ADR-017
export async function adapterConformance(
	targets: readonly DicomTarget[],
	callingAeTitle: string,
): Promise<AdapterChecks> {
	const checks = new AdapterChecks(targets, callingAeTitle)
	for (const { aeTitle } of PEERS) {
		await checks.echo(aeTitle)
	}
	for (const aeTitle of PROBED_AE_TITLES) {
		await checks.probe(aeTitle, [smokeArtifact(SMOKE_PHOTOGRAPH), smokeArtifact(SMOKE_DOCUMENT)])
		await checks.store(aeTitle, smokeArtifact(SMOKE_PHOTOGRAPH))
		await checks.store(aeTitle, smokeArtifact(SMOKE_DOCUMENT))
	}
	const archived = smokeArtifact(SMOKE_DOCUMENT)
	await checks.store(ARCHIVE_AE_TITLE, archived)
	await checks.find(
		ARCHIVE_AE_TITLE,
		studyQuery({ identifier: { QueryRetrieveLevel: "STUDY", StudyInstanceUID: archived.studyInstanceUid } }),
		{ exactMatches: 1 },
	)
	for (const aeTitle of QUERIED_STUDY_AE_TITLES) {
		await checks.find(aeTitle, studyQuery())
	}
	for (const aeTitle of QUERIED_WORKLIST_AE_TITLES) {
		await checks.find(aeTitle, worklistQuery())
	}
	for (const aeTitle of CANCELLED_AE_TITLES) {
		await checks.cancel(aeTitle)
	}
	await checks.backpressure(EMULATOR_AE_TITLE)
	await checks.golden(EMULATOR_AE_TITLE, SMOKE_DOCUMENT)
	await checks.golden(HOSTILE_AE_TITLE, SMOKE_DOCUMENT)
	await checks.aborts(EMULATOR_AE_TITLE, STORE_ABORT_SCENARIO, FIND_ABORT_SCENARIO, SMOKE_DOCUMENT)
	await checks.aborts(HOSTILE_AE_TITLE, HOSTILE_STORE_ABORT_SCENARIO, HOSTILE_FIND_ABORT_SCENARIO, SMOKE_DOCUMENT)
	return checks
}
