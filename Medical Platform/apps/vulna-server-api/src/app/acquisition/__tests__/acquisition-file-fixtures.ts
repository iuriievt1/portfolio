import { createHash, generateKeyPairSync } from "node:crypto"
import { type AcquisitionKind, ERROR_CODE } from "@ansora/contracts"
import {
	CONFIGURATION_KEY,
	deserializePublicKey,
	HPKE_SUITE,
	type HpkeEnvelope,
	HpkeKeyRing,
	type JsonObject,
	seal,
} from "@ansora/core-server"
import { ACQUISITION_STATE, type ClinicalSteps } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { HpkeKeyService } from "../../../libs/hpke/hpke-key.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { StoredBinaryObject } from "../../binary-object/types/binary-object.types"
import type { ClosingDeviceRepository } from "../../clinical-record/repositories/closing-device.repository"
import type { ClosureRecordService } from "../../clinical-record/services/closure-record.service"
import type { DocumentRecordService } from "../../clinical-record/services/document-record.service"
import type { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import type { ViewerService } from "../../clinical-record/services/viewer.service"
import type {
	ClosedScanRecord,
	ClosedWoundRecord,
	DraftDocumentRecord,
} from "../../clinical-record/types/clinical-record.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import {
	acquisitionRow,
	CURRENT,
	DEPARTMENT,
	encounterRow,
	foundPatient,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { EncounterEmptyingService } from "../../encounter/services/encounter-emptying.service"
import type { EmptyingAct, EncounterRow } from "../../encounter/types/encounter.types"
import type { AssessmentRepository } from "../../finding/repositories/assessment.repository"
import type { BodySiteRepository } from "../../finding/repositories/body-site.repository"
import type { FindingRepository } from "../../finding/repositories/finding.repository"
import type { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import type { FindingLocationService } from "../../finding/services/finding-location.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { SessionRepository } from "../../login/repositories/session.repository"
import type { UserSession } from "../../login/types/login.types"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { QUEUE_SENDER } from "../constants/queue-sender.constants"
import type { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import type { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { AssemblyTaskRepository } from "../repositories/assembly-task.repository"
import type { DecidedAcquisitionRepository } from "../repositories/decided-acquisition.repository"
import type { DeliveryRepository } from "../repositories/delivery.repository"
import type { DocumentRepository } from "../repositories/document.repository"
import type { FileUploadTaskRepository } from "../repositories/file-upload-task.repository"
import type { SeriesRepository } from "../repositories/series.repository"
import type { UploadPermissionRepository } from "../repositories/upload-permission.repository"
import { AcquisitionCancellationService } from "../services/acquisition-cancellation.service"
import { AcquisitionClosureService } from "../services/acquisition-closure.service"
import { AcquisitionDiscardService } from "../services/acquisition-discard.service"
import type { AcquisitionDraftViewService } from "../services/acquisition-draft-view.service"
import { AcquisitionFileAnnouncementService } from "../services/acquisition-file-announcement.service"
import { AcquisitionFileOrderService } from "../services/acquisition-file-order.service"
import { AcquisitionFileRemovalService } from "../services/acquisition-file-removal.service"
import { AcquisitionFileReplacementService } from "../services/acquisition-file-replacement.service"
import { AcquisitionFileUploadService } from "../services/acquisition-file-upload.service"
import { DraftAccessService } from "../services/draft-access.service"
import { DraftRemovalService } from "../services/draft-removal.service"
import { OperatorVerificationService } from "../services/operator-verification.service"
import { ScanDocumentService } from "../services/scan-document.service"
import { StoredContentService } from "../services/stored-content.service"
import { UploadPermissionService } from "../services/upload-permission.service"
import { UploadedContentService } from "../services/uploaded-content.service"
import type { AcquisitionRow, DecisionReason, DraftClosing, SeriesOwner, SeriesRow } from "../types/acquisition.types"
import type {
	AcquisitionFileRow,
	DocumentRow,
	DocumentTitleChoice,
	FileCountRow,
	NewAnnouncedFile,
	ReceivedContent,
	ReplacedContent,
	SealedContent,
} from "../types/acquisition-file.types"
import type { QueueSender, UploadPermission, UploadPermissionRow } from "../types/queue-sender.types"
import { encountersOfId, seriesFake } from "./scan-document-fakes"

export const DRAFT_ID = acquisitionRow().id
export const OTHER_DEVICE = "45454545-4545-4545-8545-454545454545"
export const CLOSING_DEVICE_MODEL = "SM-A576B"
export const FILE_A = "a1000000-0000-4000-8000-000000000001"
export const FILE_B = "a1000000-0000-4000-8000-000000000002"
export const FILE_C = "a1000000-0000-4000-8000-000000000003"
export const KEY_VERSION = "2026-10"
export const MAX_IMAGES = 20
// CAP-016-R16
export const BODY_SITE = {
	acquisition_id: acquisitionRow().id,
	region_code: "181553006",
	laterality: "R",
	view: "anterior",
	x: 0.375,
	y: 0.755,
	body_diagram_version: "1",
}
// CAP-017-R03
export const ASSESSMENT = {
	acquisition_id: acquisitionRow().id,
	healing_phase_code: "granulating",
	code_list_version: 1,
	description: "Bez známek infekce",
}
export const MAX_BYTES = 1024 * 1024
export const PERMISSION_LIFETIME_SECONDS = 86_400
export const USER_SENDER: QueueSender = { kind: QUEUE_SENDER.USER, current: CURRENT }

const SOI = [0xff, 0xd8]
const EOI = [0xff, 0xd9]
// ITU-T T.81 B.2.2, B.2.3, B.2.4, integrace-dicom.md 3.1
const QUANTIZATION = [0xff, 0xdb, 0x00, 0x06, 0x00, 0x01, 0x02, 0x03]
const HUFFMAN = [0xff, 0xc4, 0x00, 0x06, 0x00, 0x01, 0x02, 0x03]
const BASELINE_FRAME = [
	0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
]
const SCAN = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34]
const IMAGE_TABLES_AND_SCAN = [...QUANTIZATION, ...HUFFMAN, ...BASELINE_FRAME, ...SCAN]

export interface StoredFile extends AcquisitionFileRow {
	acquisitionId: string
	kind: AcquisitionKind
}

// CAP-021-R07
export function jpegWith(orientation: number | undefined, littleEndian = false): Buffer {
	if (orientation === undefined) {
		return Buffer.from([...SOI, ...IMAGE_TABLES_AND_SCAN, ...EOI])
	}
	const tiff = Buffer.alloc(26)
	tiff.write(littleEndian ? "II" : "MM", 0, "latin1")
	const short = (value: number, at: number) =>
		littleEndian ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at)
	const long = (value: number, at: number) =>
		littleEndian ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at)
	short(42, 2)
	long(8, 4)
	short(1, 8)
	short(0x01_12, 10)
	short(3, 12)
	long(1, 14)
	short(orientation, 18)
	const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff])
	const length = Buffer.alloc(2)
	length.writeUInt16BE(exif.length + 2)
	return Buffer.concat([
		Buffer.from(SOI),
		Buffer.from([0xff, 0xe1]),
		length,
		exif,
		Buffer.from([...IMAGE_TABLES_AND_SCAN, ...EOI]),
	])
}

export function sha256Of(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex")
}

export function plainContent(file: Buffer, thumbnail: Buffer | undefined = Buffer.from("thumb")): SealedContent {
	return { file, thumbnail, encryption: undefined, thumbnailEncryption: undefined }
}

export interface Transactional {
	snapshot(): () => void
}

function arraySnapshot<Item>(items: Item[], copy: (item: Item) => Item = (item) => item): () => void {
	const saved = items.map(copy)
	return () => {
		items.splice(0, items.length, ...saved.map(copy))
	}
}

function mapSnapshot<Key, Value>(entries: Map<Key, Value>): () => void {
	const saved = new Map(entries)
	return () => {
		entries.clear()
		for (const [key, value] of saved) {
			entries.set(key, value)
		}
	}
}

export class RollingBackDatabase {
	private readonly pending: Array<() => void> = []

	constructor(private readonly stores: readonly Transactional[]) {}

	// CAP-021-R29
	beforeNextTransaction(change: () => void): void {
		this.pending.push(change)
	}

	asService(): DatabaseService {
		const tx = (async () => []) as unknown as postgres.TransactionSql
		const sql = Object.assign(async () => [], {
			begin: async (work: (transaction: postgres.TransactionSql) => Promise<unknown>) => {
				this.pending.shift()?.()
				const restores = this.stores.map((store) => store.snapshot())
				try {
					return await work(tx)
				} catch (error) {
					for (const restore of restores) {
						restore()
					}
					throw error
				}
			},
		})
		return { sql } as unknown as DatabaseService
	}
}

export class FakeAudit implements Transactional {
	events: NewAuditEvent[] = []
	failing = false

	snapshot(): () => void {
		return arraySnapshot(this.events)
	}

	asRepository(): AuditRepository {
		return {
			append: async (_tx: never, event: NewAuditEvent) => {
				if (this.failing) {
					throw new Error("the audit cannot be written")
				}
				this.events.push(event)
			},
		} as unknown as AuditRepository
	}
}

export class FakeFiles implements Transactional {
	rows: StoredFile[] = []
	private nextId = 1

	snapshot(): () => void {
		return arraySnapshot(this.rows, (row) => ({ ...row }))
	}

	add(row: Partial<StoredFile> & { file_key: string }): StoredFile {
		const stored: StoredFile = {
			id: `f0000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
			acquisitionId: DRAFT_ID,
			kind: "photo",
			sequence: this.rows.length + 1,
			proposed_sequence: null,
			status: FILE_STATUS.ANNOUNCED,
			binary_object_id: null,
			thumbnail_binary_object_id: null,
			sha256: null,
			original_upload_sha256: null,
			edit_kind: null,
			edited_at: null,
			announced_by_device_id: null,
			replaces_file_id: null,
			announced_at: new Date("2026-10-07T07:59:30Z"),
			received_at: null,
			...row,
		}
		this.rows.push(stored)
		return stored
	}

	received(fileKey: string, overrides: Partial<StoredFile> = {}): StoredFile {
		const sha = sha256Of(Buffer.from(fileKey))
		return this.add({
			file_key: fileKey,
			status: FILE_STATUS.RECEIVED,
			binary_object_id: `object-of-${fileKey}`,
			thumbnail_binary_object_id: `thumbnail-of-${fileKey}`,
			sha256: sha,
			original_upload_sha256: sha,
			received_at: new Date("2026-10-07T07:59:40Z"),
			...overrides,
		})
	}

	byKey(fileKey: string): StoredFile | undefined {
		return this.rows.find((row) => row.file_key === fileKey)
	}

	asRepository(): AcquisitionFileRepository {
		const of = (acquisitionId: string, kind: AcquisitionKind) =>
			this.rows.filter((row) => row.acquisitionId === acquisitionId && row.kind === kind)
		const copy = (row: StoredFile | undefined): AcquisitionFileRow | undefined =>
			row === undefined ? undefined : { ...row }
		const byId = (id: string) => {
			const row = this.rows.find((candidate) => candidate.id === id)
			if (row === undefined) {
				throw new Error(`no file ${id}`)
			}
			return row
		}
		return {
			listHeld: async (_sql: never, acquisitionId: string, kind: AcquisitionKind) =>
				of(acquisitionId, kind)
					.filter((row) => row.status !== FILE_STATUS.REMOVED)
					.sort(
						(left, right) =>
							left.sequence - right.sequence || left.announced_at.getTime() - right.announced_at.getTime(),
					)
					.map((row) => ({ ...row })),
			findByKey: async (_sql: never, acquisitionId: string, kind: AcquisitionKind, fileKey: string) =>
				copy(of(acquisitionId, kind).find((row) => row.file_key === fileKey)),
			findById: async (_sql: never, acquisitionId: string, kind: AcquisitionKind, id: string) =>
				copy(of(acquisitionId, kind).find((row) => row.id === id)),
			requireById: async (_sql: never, acquisitionId: string, kind: AcquisitionKind, id: string) => {
				const row = copy(of(acquisitionId, kind).find((candidate) => candidate.id === id))
				if (row === undefined) {
					throw new Error(`no file ${id}`)
				}
				return row
			},
			nextSequence: async (_tx: never, acquisitionId: string, kind: AcquisitionKind) =>
				Math.max(0, ...of(acquisitionId, kind).map((row) => row.sequence)) + 1,
			insertAnnounced: async (_tx: never, file: NewAnnouncedFile) => {
				this.rows.push({
					id: file.id,
					acquisitionId: file.acquisitionId,
					kind: file.kind,
					file_key: file.fileKey,
					sequence: file.sequence,
					proposed_sequence: file.proposedSequence,
					status: FILE_STATUS.ANNOUNCED,
					binary_object_id: null,
					thumbnail_binary_object_id: null,
					sha256: null,
					original_upload_sha256: null,
					edit_kind: null,
					edited_at: null,
					announced_by_device_id: file.deviceId,
					replaces_file_id: file.replacesFileId,
					announced_at: file.announcedAt,
					received_at: null,
				})
			},
			markReceived: async (_tx: never, _kind: AcquisitionKind, fileId: string, content: ReceivedContent) => {
				Object.assign(byId(fileId), {
					status: FILE_STATUS.RECEIVED,
					binary_object_id: content.binaryObjectId,
					thumbnail_binary_object_id: content.thumbnailBinaryObjectId ?? null,
					sha256: content.sha256,
					original_upload_sha256: content.sha256,
					received_at: content.receivedAt,
				})
			},
			markRejected: async (_tx: never, _kind: AcquisitionKind, fileId: string) => {
				byId(fileId).status = FILE_STATUS.REJECTED
			},
			markRemoved: async (_tx: never, _kind: AcquisitionKind, fileId: string) => {
				Object.assign(byId(fileId), {
					status: FILE_STATUS.REMOVED,
					binary_object_id: null,
					thumbnail_binary_object_id: null,
					received_at: null,
				})
			},
			replaceContent: async (_tx: never, _kind: AcquisitionKind, fileId: string, content: ReplacedContent) => {
				Object.assign(byId(fileId), {
					binary_object_id: content.binaryObjectId,
					thumbnail_binary_object_id: content.thumbnailBinaryObjectId ?? null,
					sha256: content.sha256,
					edit_kind: content.editKind,
					edited_at: content.editedAt,
				})
			},
			renumber: async (_tx: never, _kind: AcquisitionKind, orderedIds: readonly string[]) => {
				orderedIds.forEach((id, index) => {
					byId(id).sequence = index + 1
				})
			},
			binaryObjectIdsOf: async (_sql: never, acquisitionId: string, kind: AcquisitionKind) =>
				of(acquisitionId, kind).flatMap((row) =>
					[row.binary_object_id, row.thumbnail_binary_object_id].flatMap((id) => (id === null ? [] : [id])),
				),
			countsOf: async (): Promise<FileCountRow[]> => [],
		} as unknown as AcquisitionFileRepository
	}
}

export class FakeDrafts implements Transactional {
	rows = new Map<string, AcquisitionRow>()
	decided = new Map<string, DecisionReason>()
	closings: DraftClosing[] = []

	snapshot(): () => void {
		const restores = [mapSnapshot(this.rows), mapSnapshot(this.decided), arraySnapshot(this.closings)]
		return () => {
			for (const restore of restores) {
				restore()
			}
		}
	}

	constructor(draft: AcquisitionRow = acquisitionRow()) {
		this.rows.set(draft.id, draft)
	}

	get draft(): AcquisitionRow {
		const row = this.rows.get(DRAFT_ID)
		if (row === undefined) {
			throw new Error("the draft is gone")
		}
		return row
	}

	asRepository(): AcquisitionDraftRepository {
		const changed = (id: string, changes: Partial<AcquisitionRow>, now: Date) => {
			const row = this.rows.get(id)
			if (row === undefined || row.state !== ACQUISITION_STATE.DRAFT) {
				throw new Error(`changing the draft ${id} returned no row`)
			}
			const next = { ...row, ...changes, version: row.version + 1, updated_at: now }
			this.rows.set(id, next)
			return next
		}
		return {
			findById: async (_sql: never, id: string) => this.rows.get(id),
			lockById: async (_tx: never, id: string) => this.rows.get(id),
			bump: async (_tx: never, id: string, now: Date) => changed(id, {}, now),
			close: async (_tx: never, id: string, closing: DraftClosing, now: Date) => {
				this.closings.push(closing)
				return changed(
					id,
					{ state: ACQUISITION_STATE.RECEIVED, closed_at: closing.closedAt, file_count: closing.fileCount },
					now,
				)
			},
			deleteDrafts: async (_tx: never, ids: readonly string[]) => {
				for (const id of ids) {
					this.rows.delete(id)
				}
			},
		} as unknown as AcquisitionDraftRepository
	}

	asDecided(): DecidedAcquisitionRepository {
		return {
			isDecided: async (_sql: never, id: string) => this.decided.has(id),
			record: async (_tx: never, rows: readonly AcquisitionRow[], reason: DecisionReason) => {
				for (const row of rows) {
					this.decided.set(row.id, reason)
				}
			},
		} as unknown as DecidedAcquisitionRepository
	}
}

export class FakeBinaries implements Transactional {
	stored = new Map<string, Buffer>()
	recordedRows: string[] = []
	removedRows: string[] = []
	discardedBytes: string[] = []
	private nextId = 1

	snapshot(): () => void {
		const restores = [arraySnapshot(this.recordedRows), arraySnapshot(this.removedRows)]
		return () => {
			for (const restore of restores) {
				restore()
			}
		}
	}

	asService(): BinaryObjectService {
		return {
			putBytes: async (bytes: Buffer) => {
				const id = `object-${this.nextId++}`
				this.stored.set(id, bytes)
				return { id, sizeBytes: bytes.length, sha256: sha256Of(bytes) }
			},
			record: async (_tx: never, objects: readonly StoredBinaryObject[]) => {
				this.recordedRows.push(...objects.map((object) => object.id))
			},
			removeAll: async (_tx: never, ids: readonly string[]) => {
				this.removedRows.push(...ids)
			},
			discardBytes: async (ids: readonly string[]) => {
				this.discardedBytes.push(...ids)
				for (const id of ids) {
					this.stored.delete(id)
				}
			},
		} as unknown as BinaryObjectService
	}
}

// ADR-014
type StoredPermission = UploadPermissionRow & { expires_at: Date }

export class FakePermissions implements Transactional {
	rows = new Map<string, StoredPermission>()

	snapshot(): () => void {
		return mapSnapshot(this.rows)
	}

	asRepository(): UploadPermissionRepository {
		return {
			replace: async (_tx: never, tokenHash: string, permission: UploadPermission, expiresAt: Date) => {
				for (const [hash, row] of this.rows) {
					if (row.acquisition_id === permission.acquisitionId && row.file_key === permission.fileKey) {
						this.rows.delete(hash)
					}
				}
				this.rows.set(tokenHash, {
					acquisition_id: permission.acquisitionId,
					file_key: permission.fileKey,
					device_id: permission.deviceId,
					sender_session_id: permission.senderSession?.sessionId ?? null,
					sender_user_id: permission.senderSession?.userId ?? null,
					sha256: permission.sha256,
					expires_at: expiresAt,
				})
			},
			findValid: async (tokenHash: string, now: Date): Promise<UploadPermissionRow | undefined> => {
				const stored = this.rows.get(tokenHash)
				if (stored === undefined || stored.expires_at <= now) {
					return undefined
				}
				const { expires_at: _expiresAt, ...row } = stored
				return row
			},
		} as unknown as UploadPermissionRepository
	}
}

interface QueuedUploads {
	kind: AcquisitionKind
	fileIds: string[]
}

// datovy-model.md 3, ADR-054
export class FakeClosing implements Transactional {
	lockedEncounters: string[] = []
	series = new Map<string, SeriesRow>()
	deliveries: string[] = []
	enqueued: string[] = []
	queuedUploads: QueuedUploads[] = []
	woundRecords: ClosedWoundRecord[] = []
	scanRecords: ClosedScanRecord[] = []
	storeWrites = 0
	isStoreUnavailable = false
	isDeviceRegistered = true

	snapshot(): () => void {
		const restores = [
			arraySnapshot(this.lockedEncounters),
			mapSnapshot(this.series),
			arraySnapshot(this.deliveries),
			arraySnapshot(this.enqueued),
			arraySnapshot(this.queuedUploads),
			arraySnapshot(this.woundRecords),
			arraySnapshot(this.scanRecords),
		]
		return () => {
			for (const restore of restores) {
				restore()
			}
		}
	}

	asSeries(): SeriesRepository {
		return {
			lockEncounter: async (_tx: never, encounterId: string) => {
				this.lockedEncounters.push(encounterId)
			},
			assign: async (_tx: never, owner: SeriesOwner) => {
				const key = `${owner.encounterId}:${owner.findingId ?? owner.documentId}`
				const known = this.series.get(key)
				if (known !== undefined) {
					return known
				}
				const number = [...this.series.keys()].filter((other) => other.startsWith(owner.encounterId)).length + 1
				const row = { id: `series-${number}`, series_instance_uid: `2.25.${number}`, series_number: number }
				this.series.set(key, row)
				return row
			},
		} as unknown as SeriesRepository
	}

	asDeliveries(): DeliveryRepository {
		return {
			createWaiting: async (_tx: never, acquisitionId: string) => {
				this.deliveries.push(acquisitionId)
			},
		} as unknown as DeliveryRepository
	}

	asAssemblies(): AssemblyTaskRepository {
		return {
			enqueue: async (_tx: never, acquisitionId: string) => {
				this.enqueued.push(acquisitionId)
			},
		} as unknown as AssemblyTaskRepository
	}

	asUploads(): FileUploadTaskRepository {
		return {
			enqueue: async (_tx: never, kind: AcquisitionKind, fileIds: readonly string[]) => {
				this.queuedUploads.push({ kind, fileIds: [...fileIds] })
			},
		} as unknown as FileUploadTaskRepository
	}

	asRecords(): ClosureRecordService {
		const written = (): void => {
			this.storeWrites += 1
			if (this.isStoreUnavailable) {
				throw new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
			}
		}
		return {
			recordWound: async (_tx: never, record: ClosedWoundRecord) => {
				written()
				this.woundRecords.push(record)
			},
			recordScan: async (_tx: never, record: ClosedScanRecord) => {
				written()
				this.scanRecords.push(record)
			},
		} as unknown as ClosureRecordService
	}

	asDevices(): ClosingDeviceRepository {
		return {
			stationOf: async (_sql: never, deviceId: string) =>
				this.isDeviceRegistered ? { deviceId, model: CLOSING_DEVICE_MODEL } : undefined,
		} as unknown as ClosingDeviceRepository
	}
}

export interface ServerKey {
	hpke: HpkeKeyService
	sealed(bytes: Buffer): { envelope: HpkeEnvelope; ciphertext: Buffer }
}

// CAP-021-R21
export function serverKey(): ServerKey {
	const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
	const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
	const ring = HpkeKeyRing.fromPem([{ version: KEY_VERSION, pem }], KEY_VERSION)
	const publicKey = deserializePublicKey(Buffer.from(ring.serverHpkeKey().public_key, "base64url"))
	return {
		hpke: { openEnvelope: (envelope, ciphertext) => ring.openEnvelope(envelope, ciphertext) } as HpkeKeyService,
		sealed: (bytes) => {
			const message = seal(publicKey, bytes)
			return {
				envelope: { enc: message.enc.toString("base64url"), suite: HPKE_SUITE, server_key_version: KEY_VERSION },
				ciphertext: message.ciphertext,
			}
		},
	}
}

export interface ClinicalState {
	hasBodySite: boolean
	originAcquisitionId: string
	woundTypeCode: string | null
	hasAssessment: boolean
	clinicalSteps: ClinicalSteps
	document: DocumentRow | undefined
	operatorSession: UserSession | undefined
	encounter: EncounterRow
	emptied: EncounterRow | undefined
}

export function fileHarness(draft: AcquisitionRow = acquisitionRow(), clinical: Partial<ClinicalState> = {}) {
	const state: ClinicalState = {
		hasBodySite: true,
		originAcquisitionId: draft.id,
		woundTypeCode: "leg-ulcer",
		hasAssessment: true,
		clinicalSteps: { woundType: true, healingPhase: true },
		document: undefined,
		operatorSession: undefined,
		encounter: encounterRow(),
		emptied: undefined,
		...clinical,
	}
	const files = new FakeFiles()
	const drafts = new FakeDrafts(draft)
	const binaries = new FakeBinaries()
	const auditLog = new FakeAudit()
	const closing = new FakeClosing()
	const permissionRows = new FakePermissions()
	const transactions = new RollingBackDatabase([files, drafts, binaries, auditLog, closing, permissionRows])
	const database = transactions.asService()
	const key = serverKey()
	const audits = auditLog.events
	const steps: string[] = []
	const emptiedActs: EmptyingAct[] = []
	const titles: DocumentTitleChoice[] = []
	const fileRepository = files.asRepository()
	const draftRepository = drafts.asRepository()
	const binaryService = binaries.asService()
	const storedContents = new StoredContentService(binaryService)
	const decided = drafts.asDecided()
	const access = new DraftAccessService(draftRepository, decided)
	const configuration = {
		integer: async (configurationKey: string) => {
			if (configurationKey === CONFIGURATION_KEY.ACQUISITION_MAX_BYTES) {
				return MAX_BYTES
			}
			if (configurationKey === CONFIGURATION_KEY.ACQUISITION_UPLOAD_PERMISSION_LIFETIME_SECONDS) {
				return PERMISSION_LIFETIME_SECONDS
			}
			return MAX_IMAGES
		},
		clinicalSteps: async () => state.clinicalSteps,
	} as unknown as ConfigurationService
	const documents = {
		findByAcquisition: async () => state.document,
		setTitle: async (_tx: never, _id: string, title: DocumentTitleChoice) => {
			titles.push(title)
		},
	} as unknown as DocumentRepository
	const patients = new PatientLookupService({
		byIds: async (ids: readonly string[]) => ids.map((id) => foundPatient(id)),
	} as unknown as PatientRepository)
	const audit = auditLog.asRepository()
	const contents = new UploadedContentService(key.hpke)
	const permissions = new UploadPermissionService(permissionRows.asRepository(), configuration)
	const announcements = new AcquisitionFileAnnouncementService(
		database,
		access,
		draftRepository,
		fileRepository,
		permissions,
		configuration,
	)
	const views = {
		viewOf: async (_sql: never, row: AcquisitionRow) => ({ acquisition_id: row.id, version: row.version }),
	} as unknown as AcquisitionDraftViewService
	const viewers = { viewerOf: async () => ({ userId: USER, departmentId: DEPARTMENT }) } as unknown as ViewerService
	const sites = {
		findByAcquisition: async () => (state.hasBodySite ? BODY_SITE : undefined),
	} as unknown as BodySiteRepository
	const findings = {
		findById: async (_sql: never, id: string) => ({
			id,
			origin_acquisition_id: state.originAcquisitionId,
			wound_type_code: state.woundTypeCode,
		}),
	} as unknown as FindingRepository
	const assessmentRows = {
		findByAcquisition: async () => (state.hasAssessment ? ASSESSMENT : undefined),
	} as unknown as AssessmentRepository
	const sessions = { findById: async () => state.operatorSession } as unknown as SessionRepository
	const encounters = {
		findById: async (_sql: never, id: string) => ({ ...state.encounter, id }),
		lockByIds: async (_tx: never, ids: readonly string[]) => ids.map((id) => ({ ...state.encounter, id })),
	} as unknown as EncounterRepository
	const emptying = {
		emptyIfBare: async () => state.emptied,
		recordEmptied: async (_tx: never, _previous: EncounterRow, _emptied: EncounterRow, act: EmptyingAct) => {
			emptiedActs.push(act)
		},
	} as unknown as EncounterEmptyingService
	const records = {
		record: async (_tx: never, encounter: EncounterRow) => {
			steps.push(`record encounter:${encounter.status}`)
		},
	} as unknown as EncounterRecordService
	const draftAssessments = {
		withdraw: async () => {
			steps.push("withdraw assessment")
		},
	} as unknown as DraftAssessmentService
	const locations = {
		withdrawNew: async () => {
			steps.push("withdraw new finding")
		},
	} as unknown as FindingLocationService
	const documentRecords = {
		withdrawDraft: async (_tx: never, record: DraftDocumentRecord) => {
			steps.push(`withdraw document:${record.documentId}`)
		},
	} as unknown as DocumentRecordService
	const removal = new DraftRemovalService(
		draftRepository,
		decided,
		fileRepository,
		binaryService,
		draftAssessments,
		locations,
		new ScanDocumentService(documents, seriesFake().repository, encountersOfId(), documentRecords),
		emptying,
		records,
		patients,
		audit,
	)
	return {
		state,
		files,
		drafts,
		binaries,
		key,
		audits,
		auditLog,
		closing,
		permissionRows,
		permissions,
		transactions,
		steps,
		emptiedActs,
		titles,
		announcements,
		uploads: new AcquisitionFileUploadService(
			database,
			access,
			draftRepository,
			fileRepository,
			announcements,
			contents,
			storedContents,
			configuration,
			patients,
			audit,
		),
		removals: new AcquisitionFileRemovalService(
			database,
			access,
			draftRepository,
			fileRepository,
			binaryService,
			patients,
			audit,
		),
		replacements: new AcquisitionFileReplacementService(
			database,
			access,
			draftRepository,
			fileRepository,
			contents,
			storedContents,
			binaryService,
			configuration,
			patients,
			audit,
		),
		orders: new AcquisitionFileOrderService(
			database,
			access,
			draftRepository,
			fileRepository,
			views,
			viewers,
			patients,
			audit,
		),
		closures: new AcquisitionClosureService(
			database,
			access,
			draftRepository,
			fileRepository,
			documents,
			sites,
			findings,
			assessmentRows,
			encounters,
			closing.asSeries(),
			closing.asDeliveries(),
			closing.asAssemblies(),
			closing.asUploads(),
			closing.asRecords(),
			closing.asDevices(),
			new OperatorVerificationService(database, sessions),
			patients,
			audit,
			configuration,
		),
		discards: new AcquisitionDiscardService(database, access, encounters, removal, binaryService),
		cancellations: new AcquisitionCancellationService(
			database,
			access,
			encounters,
			fileRepository,
			removal,
			binaryService,
		),
	}
}

export function detailsOf(event: NewAuditEvent | undefined): JsonObject {
	if (event === undefined) {
		throw new Error("no audit event")
	}
	return event.details
}
