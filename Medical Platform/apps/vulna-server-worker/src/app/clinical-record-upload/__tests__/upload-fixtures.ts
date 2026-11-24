import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import {
	type BinaryPlacement,
	type BinaryStorePort,
	type DurableBinaryStorePort,
	JOB_OBJECT_KIND,
	type NewQueueTask,
	type QueueTaskStore,
} from "@ansora/core-server"
import type { ClinicalRecordStoreError } from "@ansora/vulna-domain"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { BinaryObject } from "../../../libs/binary-store/binary-object"
import type { DatabaseService } from "../../../libs/database/database.service"
import { UPLOAD_OBJECT_KINDS } from "../constants/clinical-record-upload.constants"
import type { FileBinaryRepository } from "../repositories/file-binary.repository"
import type { UploadAlertRepository } from "../repositories/upload-alert.repository"
import type { UploadTaskRepository } from "../repositories/upload-task.repository"
import type { DurableBinaryStoreService } from "../services/durable-binary-store.service"
import type {
	ClaimedUploadTask,
	FileBinaries,
	StoredRendition,
	UploadAlertKind,
	UploadJobKind,
} from "../types/clinical-record-upload.types"

export const TASK_ID = "33333333-3333-4333-8333-333333333333"
export const FILE_ID = "55555555-5555-4555-8555-555555555555"
export const RECORD_ID = "66666666-6666-4666-8666-666666666666"
export const OWNER_REFERENCE = "Encounter/encounter-resource"
export const ALERT_ID = "77777777-7777-4777-8777-777777777777"
const REQUESTED_AT = "1791363600123456"

export function sha256Of(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex")
}

export function taskOf(overrides: Partial<ClaimedUploadTask> = {}): ClaimedUploadTask {
	return {
		id: TASK_ID,
		objectKind: JOB_OBJECT_KIND.IMAGE,
		objectId: FILE_ID,
		attempts: 1,
		unknownOutcomes: 0,
		requestedAt: REQUESTED_AT,
		...overrides,
	}
}

export function renditionOf(binaryObjectId: string, overrides: Partial<StoredRendition> = {}): StoredRendition {
	const bytes = Buffer.from(`bytes of ${binaryObjectId}`)
	return {
		binaryObjectId,
		sizeBytes: bytes.length,
		sha256: sha256Of(bytes),
		clinicalRecordBinaryId: null,
		isUploaded: false,
		...overrides,
	}
}

export function fileOf(overrides: Partial<FileBinaries> = {}): FileBinaries {
	return {
		kind: JOB_OBJECT_KIND.IMAGE,
		fileId: FILE_ID,
		recordId: RECORD_ID,
		ownerReference: OWNER_REFERENCE,
		original: renditionOf("original"),
		thumbnail: renditionOf("thumbnail"),
		viewingCopy: renditionOf("viewing-copy"),
		...overrides,
	}
}

interface RaisedAlert {
	kind: UploadAlertKind
	taskId: string
	message: string
}

export interface UploadHarnessOptions {
	file?: FileBinaries | undefined
	task?: ClaimedUploadTask
	isStoreConfigured?: boolean
	uploadFailure?: ClinicalRecordStoreError
	keptBinaries?: ReadonlyMap<string, Uint8Array>
	readsBack?: (binaryId: string, uploaded: Uint8Array) => Uint8Array | undefined
}

// datovy-model.md 4, CAP-021-R36
export class UploadWorld {
	readonly steps: string[] = []
	readonly alerts: RaisedAlert[] = []
	readonly resolvedAlerts: string[] = []
	readonly audits: SystemJobAuditEvent[] = []
	readonly uploads: { bytes: Uint8Array; placement: BinaryPlacement }[] = []
	readonly buffer = new Map<string, Uint8Array>()
	readonly unreadable = new Set<string>()
	readonly attachedCopies: BinaryObject[] = []
	readonly durable: Map<string, Uint8Array>
	claims = 0

	constructor(private readonly options: UploadHarnessOptions = {}) {
		this.durable = new Map(options.keptBinaries ?? [])
		const file = "file" in options ? options.file : fileOf()
		for (const rendition of file === undefined ? [] : [file.original, file.thumbnail, file.viewingCopy]) {
			if (rendition !== undefined) {
				this.buffer.set(rendition.binaryObjectId, Buffer.from(`bytes of ${rendition.binaryObjectId}`))
			}
		}
	}

	asDatabase(): DatabaseService {
		return {
			sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
		} as unknown as DatabaseService
	}

	asTasks(): UploadTaskRepository {
		return {
			queue: this.asQueue(),
			claimRuleOf: (kind: UploadJobKind) => ({
				kind,
				objectKinds: UPLOAD_OBJECT_KINDS[kind],
				condition: undefined,
				countsAttempts: true,
			}),
		} as unknown as UploadTaskRepository
	}

	asQueue(): QueueTaskStore {
		let isClaimed = false
		return {
			claim: async () => {
				this.claims += 1
				if (isClaimed) {
					return undefined
				}
				isClaimed = true
				return this.options.task ?? taskOf()
			},
			renewLease: async () => true,
			enqueue: async (_tx: never, task: NewQueueTask) => {
				this.steps.push(`queue ${task.kind} of ${task.objectKind} ${task.objectId}`)
			},
			complete: async (_tx: never, taskId: string) => {
				this.steps.push(`complete ${taskId}`)
			},
			retryLater: async (taskId: string) => {
				this.steps.push(`retry ${taskId}`)
			},
			retryAfterUnknownOutcome: async (taskId: string) => {
				this.steps.push(`retry unknown ${taskId}`)
			},
			fail: async (_tx: never, taskId: string) => {
				this.steps.push(`fail ${taskId}`)
			},
		} as unknown as QueueTaskStore
	}

	asAlerts(): UploadAlertRepository {
		return {
			raiseForTask: async (_tx: never, kind: UploadAlertKind, taskId: string, message: string) => {
				this.alerts.push({ kind, taskId, message })
				return ALERT_ID
			},
			resolveForTask: async (_tx: never, taskId: string) => {
				this.resolvedAlerts.push(taskId)
			},
		} as unknown as UploadAlertRepository
	}

	asAudit(): AuditRepository {
		return {
			appendSystemJob: async (_tx: never, event: SystemJobAuditEvent) => {
				this.audits.push(event)
			},
		} as unknown as AuditRepository
	}

	asFiles(): FileBinaryRepository {
		return {
			find: async () => ("file" in this.options ? this.options.file : fileOf()),
			rememberBinaryId: async (binaryObjectId: string, binaryId: string) => {
				this.steps.push(`remember ${binaryObjectId} as ${binaryId}`)
			},
			confirmUpload: async (binaryObjectId: string) => {
				this.steps.push(`confirm ${binaryObjectId}`)
			},
			attachViewingCopy: async (_tx: never, kind: string, fileId: string, copy: BinaryObject) => {
				this.steps.push(`attach copy of ${kind} ${fileId}`)
				this.attachedCopies.push(copy)
			},
		} as unknown as FileBinaryRepository
	}

	asStores(): DurableBinaryStoreService {
		const store: DurableBinaryStorePort = {
			upload: async (content, placement) => {
				if (this.options.uploadFailure !== undefined) {
					throw this.options.uploadFailure
				}
				const bytes = await buffer(content)
				this.uploads.push({ bytes, placement })
				const binaryId = `binary-${this.uploads.length}`
				this.durable.set(binaryId, bytes)
				return binaryId
			},
			sha256Of: async (binaryId) => {
				const stored = this.durable.get(binaryId)
				if (stored === undefined) {
					return undefined
				}
				const readBack = this.options.readsBack?.(binaryId, stored) ?? stored
				return sha256Of(readBack)
			},
		}
		return {
			current: async () => (this.options.isStoreConfigured === false ? undefined : store),
		} as unknown as DurableBinaryStoreService
	}

	asBinaryStore(): BinaryStorePort {
		return {
			get: async (key: string) => {
				if (this.unreadable.has(key)) {
					throw new Error(`the disk cannot read ${key}`)
				}
				const bytes = this.buffer.get(key)
				if (bytes === undefined) {
					throw new Error(`no bytes ${key}`)
				}
				return Readable.from([Buffer.from(bytes)])
			},
			put: async (key: string, content: Readable) => {
				this.buffer.set(key, await buffer(content))
				this.steps.push(`put ${key}`)
			},
			delete: async () => undefined,
			exists: async (key: string) => this.buffer.has(key),
		}
	}
}
