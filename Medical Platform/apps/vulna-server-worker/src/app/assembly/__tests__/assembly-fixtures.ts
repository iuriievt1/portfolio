import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import {
	ACQUISITION_KIND,
	type AcquisitionKind,
	BODY_VIEWS,
	CODE_LIST,
	type CodeListCode,
	DELIVERY_STATE,
	type DeliveryState,
	LATERALITY,
	type LocalizedNames,
	normalizedPointInRegion,
} from "@ansora/contracts"
import { type BinaryStorePort, JOB_OBJECT_KIND, type QueueTaskStore } from "@ansora/core-server"
import {
	type BodySite,
	type ClosedRecordReaderPort,
	CURRENT_BODY_DIAGRAM,
	type StoredScanRecord,
	type StoredWoundRecord,
} from "@ansora/vulna-domain"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { BinaryObject } from "../../../libs/binary-store/binary-object"
import type { DatabaseService } from "../../../libs/database/database.service"
import { jpegOf, rasterOf } from "../../clinical-record-upload/__tests__/jpeg-fixtures"
import { ALERT_ID, sha256Of, TASK_ID } from "../../clinical-record-upload/__tests__/upload-fixtures"
import type { DocumentPdfRepository } from "../../text-recognition/repositories/document-pdf.repository"
import type { DocumentPdfService } from "../../text-recognition/services/document-pdf.service"
import type { DocumentPage } from "../../text-recognition/types/text-recognition.types"
import type { AssemblyAlertRepository } from "../repositories/assembly-alert.repository"
import type { AssemblyRecordRepository } from "../repositories/assembly-record.repository"
import type { AssemblyResultRepository } from "../repositories/assembly-result.repository"
import type { CodeListNameRepository } from "../repositories/code-list-name.repository"
import { AssemblerService } from "../services/assembler.service"
import { AssemblyLane } from "../services/assembly-lane"
import type { AssemblySettingsService } from "../services/assembly-settings.service"
import type {
	ArtifactSource,
	AssemblyImage,
	AssemblySettings,
	FailedAssembly,
	FoundRecord,
	StoredArtifact,
} from "../types/assembly.types"

export { ALERT_ID, TASK_ID }
export const ACQUISITION_ID = "a0000000-0000-4000-8000-000000000001"
export const DELIVERY_ID = "d0000000-0000-4000-8000-000000000001"
export const DOCUMENT_ID = "c0000000-0000-4000-8000-000000000001"
export const STUDY_INSTANCE_UID = "2.25.300000000000000000000000000000000001"
export const SERIES_INSTANCE_UID = "2.25.300000000000000000000000000000000002"
export const HARDWARE_ID = "tHg7xQ2kP9aLmN3vR8sW1yZ4bC6dE0fG2hJ5kL7mN9p"
export const IMPLEMENTATION_CLASS_UID = "2.25.12345"
export const RELEASE = "1.0.0"
export const LANGUAGE = "cs"
export const PATIENT_ID_SYSTEM = "rc"
export const PATIENT_ID_VALUE = "7001011234"
export const OPERATOR = { familyName: "Svobodová", givenName: "Petra" }
export const TITLE_TEXT = "Propouštěcí zpráva"
export const DESCRIPTION = "Spodina granuluje."
export const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
const FINDING_ID = "f0000000-0000-4000-8000-000000000001"
const PATIENT_RESOURCE_ID = "patient-resource-1"
const SERIES_NUMBER = 3
const WOUND_NUMBER = 2
const WOUND_TYPE_CODE = "pressure-injury"
const HEALING_PHASE_CODE = "granulating"
const TITLE_CODE = "discharge-report"
export const ENGLISH_ONLY_TITLE_CODE = "referral"
const PDF_OBJECT_ID = "b0000000-0000-4000-8000-0000000000f0"
const REQUESTED_AT = "1791363600123456"
const UUID_PREFIX = "b0000000-0000-4000-8000-"
const UUID_DIGITS = 12
const HEXADECIMAL = 16
const PIXELS = 16
const GREY = 128
const FILE_COUNT = 2
const STARTED_AT = new Date("2026-11-06T08:10:00Z")
const SOP_INSTANCE_UID_ROOT = "2.25.40000000000000000000000000000000000"

const NAMES: Readonly<Record<CodeListCode, ReadonlyMap<string, LocalizedNames>>> = {
	[CODE_LIST.WOUND_TYPE]: new Map<string, LocalizedNames>([
		[WOUND_TYPE_CODE, { cs: "Dekubitus", en: "Pressure injury" }],
	]),
	[CODE_LIST.HEALING_PHASE]: new Map<string, LocalizedNames>([
		[HEALING_PHASE_CODE, { cs: "Granulační", en: "Granulation" }],
	]),
	[CODE_LIST.DOCUMENT_TITLE]: new Map<string, LocalizedNames>([
		[TITLE_CODE, { cs: TITLE_TEXT, en: "Discharge report" }],
		[ENGLISH_ONLY_TITLE_CODE, { en: "Referral" }],
	]),
}

// CAP-016-R04, CAP-016-R16
function siteOfPairedRegion(): BodySite {
	for (const view of BODY_VIEWS) {
		const drawn = CURRENT_BODY_DIAGRAM.views[view]
		if (drawn === undefined) {
			continue
		}
		for (const region of CURRENT_BODY_DIAGRAM.regions.filter((item) => item.isPaired)) {
			const point = normalizedPointInRegion(view, drawn, region.code, LATERALITY.RIGHT)
			if (point !== undefined) {
				return {
					regionCode: region.code,
					laterality: LATERALITY.RIGHT,
					view,
					...point,
					bodyDiagramVersion: CURRENT_BODY_DIAGRAM.version,
				}
			}
		}
	}
	throw new Error("the body diagram has no paired region with a point")
}

const SITE = siteOfPairedRegion()

export function objectIdOf(index: number): string {
	return `${UUID_PREFIX}${index.toString(HEXADECIMAL).padStart(UUID_DIGITS, "0")}`
}

export function jpeg(): Buffer {
	return jpegOf(rasterOf(PIXELS, PIXELS, () => [GREY, GREY, GREY]))
}

export function imageOf(sequence: number): AssemblyImage {
	return { imageId: objectIdOf(sequence), sequence, binaryObjectId: objectIdOf(10 + sequence), editKind: undefined }
}

export function recordOf(kind: AcquisitionKind, overrides: Partial<FoundRecord> = {}): FoundRecord {
	const isPhoto = kind === ACQUISITION_KIND.PHOTO
	return {
		acquisitionId: ACQUISITION_ID,
		kind,
		startedAt: STARTED_AT,
		fileCount: FILE_COUNT,
		firstInstanceNumber: 1,
		findingId: isPhoto ? FINDING_ID : undefined,
		woundNumber: isPhoto ? WOUND_NUMBER : undefined,
		documentId: isPhoto ? undefined : DOCUMENT_ID,
		operator: OPERATOR,
		closingHardwareId: HARDWARE_ID,
		encounter: {
			studyInstanceUid: STUDY_INSTANCE_UID,
			studyId: "2026-000123",
			accessionNumber: undefined,
			date: "2026-11-06",
			startedAt: STARTED_AT,
		},
		series: { seriesInstanceUid: SERIES_INSTANCE_UID, number: SERIES_NUMBER },
		patient: {
			familyName: undefined,
			givenName: undefined,
			birthDate: undefined,
			sex: undefined,
			identifiers: [{ system: PATIENT_ID_SYSTEM, value: PATIENT_ID_VALUE, issuer: undefined, validUntil: undefined }],
		},
		patientResourceId: PATIENT_RESOURCE_ID,
		delivery: { id: DELIVERY_ID, state: DELIVERY_STATE.WAITING_FOR_ASSEMBLY },
		...overrides,
	}
}

const STORED_STUDY = {
	patientResourceId: PATIENT_RESOURCE_ID,
	studyInstanceUid: STUDY_INSTANCE_UID,
	series: [{ seriesInstanceUid: SERIES_INSTANCE_UID, number: SERIES_NUMBER }],
}

export function storedWoundOf(overrides: Partial<StoredWoundRecord> = {}): StoredWoundRecord {
	return {
		acquisitionId: ACQUISITION_ID,
		patientResourceId: PATIENT_RESOURCE_ID,
		study: STORED_STUDY,
		findingId: FINDING_ID,
		site: SITE,
		healingPhaseCode: HEALING_PHASE_CODE,
		closedWoundTypeCode: WOUND_TYPE_CODE,
		description: DESCRIPTION,
		...overrides,
	}
}

export function storedScanOf(overrides: Partial<StoredScanRecord> = {}): StoredScanRecord {
	return {
		acquisitionId: ACQUISITION_ID,
		patientResourceId: PATIENT_RESOURCE_ID,
		study: STORED_STUDY,
		documentId: DOCUMENT_ID,
		title: { code: TITLE_CODE, text: TITLE_TEXT },
		...overrides,
	}
}

// CAP-021-R17, integrace-dicom.md 3, 4
export function settingsOf(reader: ClosedRecordReaderPort): AssemblySettings {
	return {
		imageTransferSyntaxes: [TRANSFER_SYNTAX.JPEG_BASELINE],
		documentTransferSyntaxes: [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN],
		identity: { implementationClassUid: IMPLEMENTATION_CLASS_UID, implementationVersionName: RELEASE },
		language: LANGUAGE,
		softwareVersion: RELEASE,
		patientIdSystem: PATIENT_ID_SYSTEM,
		reader,
	}
}

interface AssemblyOptions {
	record?: FoundRecord | undefined
	images?: AssemblyImage[]
	pageSequences?: number[]
	wound?: StoredWoundRecord | undefined
	scan?: StoredScanRecord | undefined
	hasSettings?: boolean
}

interface RaisedAlert {
	taskId: string
	deliveryId: string
	message: string
}

interface Finished {
	deliveryId: string
	artifacts: readonly StoredArtifact[]
}

// CAP-021-R04, CAP-022, ADR-054 bod 4
export class AssemblyWorld {
	readonly buffer = new Map<string, Buffer>()
	readonly steps: string[] = []
	readonly alerts: RaisedAlert[] = []
	readonly audits: SystemJobAuditEvent[] = []
	readonly finished: Finished[] = []
	readonly failed: FailedAssembly[] = []
	readonly reservations: ArtifactSource[][] = []
	readonly ocrTitles: string[] = []
	textRecognitionFailures = 0
	lockedState: DeliveryState = DELIVERY_STATE.WAITING_FOR_ASSEMBLY
	isAlertRaised = true
	finishError: Error | undefined
	recordedCheckError: Error | undefined
	readError: Error | undefined
	ocrError: Error | undefined
	putsBeforeFailure: number | undefined

	constructor(private readonly options: AssemblyOptions = {}) {
		for (const image of this.images()) {
			this.buffer.set(image.binaryObjectId, jpeg())
		}
		this.buffer.set(PDF_OBJECT_ID, PDF_BYTES)
	}

	images(): AssemblyImage[] {
		return this.options.images ?? [imageOf(1), imageOf(2)]
	}

	settings(): AssemblySettings | undefined {
		return this.options.hasSettings === false ? undefined : settingsOf(this.reader())
	}

	asDatabase(): DatabaseService {
		return {
			sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
		} as unknown as DatabaseService
	}

	asQueue(): QueueTaskStore {
		let isClaimed = false
		return {
			claim: async () => {
				if (isClaimed) {
					return undefined
				}
				isClaimed = true
				return {
					id: TASK_ID,
					objectKind: JOB_OBJECT_KIND.ACQUISITION,
					objectId: ACQUISITION_ID,
					attempts: 1,
					unknownOutcomes: 0,
					requestedAt: REQUESTED_AT,
				}
			},
			renewLease: async () => true,
			complete: async (_tx: never, taskId: string) => {
				this.steps.push(`complete ${taskId}`)
			},
			retryLater: async (taskId: string) => {
				this.steps.push(`retry ${taskId}`)
			},
			fail: async (_tx: never, taskId: string) => {
				this.steps.push(`fail ${taskId}`)
			},
		} as unknown as QueueTaskStore
	}

	asRecords(): AssemblyRecordRepository {
		return {
			find: async () => ("record" in this.options ? this.options.record : recordOf(ACQUISITION_KIND.PHOTO)),
			imagesOf: async () => this.images(),
			markAssembling: async (acquisitionId: string) => {
				this.steps.push(`assembling ${acquisitionId}`)
			},
		} as unknown as AssemblyRecordRepository
	}

	asPages(): DocumentPdfRepository {
		return {
			receivedPagesOf: async (): Promise<DocumentPage[]> =>
				(this.options.pageSequences ?? [1, FILE_COUNT]).map((sequence) => ({
					sequence,
					binaryObjectId: objectIdOf(20 + sequence),
				})),
		} as unknown as DocumentPdfRepository
	}

	asResults(queue: QueueTaskStore): AssemblyResultRepository {
		return {
			queue,
			ensuredDelivery: async (acquisitionId: string) => {
				this.steps.push(`delivery of ${acquisitionId}`)
				return { id: DELIVERY_ID, state: DELIVERY_STATE.WAITING_FOR_ASSEMBLY }
			},
			reserve: async (_acquisitionId: string, sources: readonly ArtifactSource[]) => {
				this.reservations.push([...sources])
				return sources.map((source, index) => ({
					artifactId: `artifact-${source.sourceId}`,
					sopInstanceUid: `${SOP_INSTANCE_UID_ROOT}${index + 1}`,
				}))
			},
			lockedStateOf: async () => this.lockedState,
			finish: async (_tx: never, deliveryId: string, artifacts: readonly StoredArtifact[]) => {
				if (this.finishError !== undefined) {
					throw this.finishError
				}
				this.finished.push({ deliveryId, artifacts })
				this.steps.push(`assembled ${deliveryId}`)
			},
			fail: async (_tx: never, failure: FailedAssembly) => {
				this.failed.push(failure)
				this.steps.push(`assembly failed ${failure.reason}`)
			},
			recordedObjectIdsOf: async () => {
				if (this.recordedCheckError !== undefined) {
					throw this.recordedCheckError
				}
				return new Set<string>()
			},
			countTextRecognitionFailure: async () => {
				this.textRecognitionFailures += 1
				return this.textRecognitionFailures
			},
		} as unknown as AssemblyResultRepository
	}

	asNames(): CodeListNameRepository {
		return {
			namesOf: async (codeList: CodeListCode, code: string) => NAMES[codeList].get(code),
		} as unknown as CodeListNameRepository
	}

	asAlerts(): AssemblyAlertRepository {
		return {
			raise: async (_tx: never, taskId: string, deliveryId: string, message: string) => {
				if (!this.isAlertRaised) {
					return undefined
				}
				this.alerts.push({ taskId, deliveryId, message })
				return ALERT_ID
			},
		} as unknown as AssemblyAlertRepository
	}

	asAudit(): AuditRepository {
		return {
			appendSystemJob: async (_tx: never, event: SystemJobAuditEvent) => {
				this.audits.push(event)
			},
		} as unknown as AuditRepository
	}

	asPdfs(): DocumentPdfService {
		return {
			outputPdfOf: async (_documentId: string, title: string): Promise<BinaryObject> => {
				this.ocrTitles.push(title)
				if (this.ocrError !== undefined) {
					throw this.ocrError
				}
				return { binaryObjectId: PDF_OBJECT_ID, sizeBytes: PDF_BYTES.length, sha256: sha256Of(PDF_BYTES) }
			},
		} as unknown as DocumentPdfService
	}

	asSettings(): AssemblySettingsService {
		return { current: async () => this.settings() } as unknown as AssemblySettingsService
	}

	asBinaryStore(): BinaryStorePort {
		let puts = 0
		return {
			exists: async (key: string) => this.buffer.has(key),
			get: async (key: string) => {
				const bytes = this.buffer.get(key)
				if (bytes === undefined) {
					throw new Error(`no bytes of ${key}`)
				}
				return Readable.from(bytes)
			},
			put: async (key: string, content: Readable) => {
				puts += 1
				if (this.putsBeforeFailure !== undefined && puts > this.putsBeforeFailure) {
					throw new Error("the buffer is full")
				}
				this.buffer.set(key, await buffer(content))
			},
			delete: async (key: string) => {
				this.buffer.delete(key)
			},
		}
	}

	private reader(): ClosedRecordReaderPort {
		const read = <T>(found: T): T => {
			if (this.readError !== undefined) {
				throw this.readError
			}
			return found
		}
		return {
			closedWoundRecord: async () => read("wound" in this.options ? this.options.wound : storedWoundOf()),
			closedScanRecord: async () => read("scan" in this.options ? this.options.scan : storedScanOf()),
		}
	}
}

export function assemblyHarness(options: AssemblyOptions = {}) {
	const world = new AssemblyWorld(options)
	const queue = world.asQueue()
	const assembler = new AssemblerService(
		world.asDatabase(),
		world.asRecords(),
		world.asResults(queue),
		world.asNames(),
		world.asAlerts(),
		world.asAudit(),
		world.asPdfs(),
		world.asPages(),
		world.asBinaryStore(),
	)
	return { world, lane: new AssemblyLane(queue, world.asSettings(), assembler) }
}

export function storedBytesOf(world: AssemblyWorld): Buffer[] {
	return world.finished.flatMap((finished) =>
		finished.artifacts.flatMap((artifact) =>
			artifact.variants.map((variant) => {
				const bytes = world.buffer.get(variant.object.binaryObjectId)
				if (bytes === undefined) {
					throw new Error(`no stored bytes of ${variant.object.binaryObjectId}`)
				}
				return bytes
			}),
		),
	)
}
