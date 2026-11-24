import {
	type BinaryPlacement,
	type BinaryStorePort,
	type DurableBinaryStorePort,
	FAILED_ATTEMPT_STEP,
	JOB_KIND,
	JOB_OBJECT_KIND,
	QUEUE_FAILURE,
	type QueueFailure,
} from "@ansora/core-server"
import { CLINICAL_CONTENT_TYPE, CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { DatabaseService } from "../../../libs/database/database.service"
import { UPLOAD_ALERT_KIND, UPLOAD_JOB_KIND } from "../constants/clinical-record-upload.constants"
import { DigestMismatchError } from "../errors/digest-mismatch.error"
import { MissingBufferError } from "../errors/missing-buffer.error"
import { FileBinaryRepository } from "../repositories/file-binary.repository"
import { UploadAlertRepository } from "../repositories/upload-alert.repository"
import { UploadTaskRepository } from "../repositories/upload-task.repository"
import type {
	ClaimedUploadTask,
	FileBinaries,
	FileObjectKind,
	StoredRendition,
} from "../types/clinical-record-upload.types"
import { uploadFailureMessageOf } from "../utils/upload-alert"
import { DurableBinaryStoreService } from "./durable-binary-store.service"
import { UploadTaskLoop } from "./upload-task-loop"

// CAP-021-R36, CAP-021-R39
const UPLOADED_CONTENT_TYPE = {
	[JOB_OBJECT_KIND.IMAGE]: CLINICAL_CONTENT_TYPE.JPEG,
	[JOB_OBJECT_KIND.DOCUMENT_PAGE]: CLINICAL_CONTENT_TYPE.JPEG,
	[JOB_OBJECT_KIND.DOCUMENT]: CLINICAL_CONTENT_TYPE.PDF,
} as const satisfies Record<FileObjectKind, string>

function renditionsOf(file: FileBinaries): StoredRendition[] {
	return [file.original, file.thumbnail, file.viewingCopy].filter(
		(rendition): rendition is StoredRendition => rendition !== undefined,
	)
}

// CAP-021-R36, CAP-021-R27, ADR-050 bod 10
function uploadFailureOf(error: unknown): QueueFailure {
	if (error instanceof DigestMismatchError || error instanceof MissingBufferError) {
		return QUEUE_FAILURE.PERMANENT
	}
	if (!(error instanceof ClinicalRecordStoreError)) {
		return QUEUE_FAILURE.TRANSIENT
	}
	switch (error.failure) {
		case CLINICAL_RECORD_FAILURE.REJECTED:
			return QUEUE_FAILURE.PERMANENT
		case CLINICAL_RECORD_FAILURE.UNKNOWN:
			return QUEUE_FAILURE.UNKNOWN_OUTCOME
		case CLINICAL_RECORD_FAILURE.UNAVAILABLE:
			return QUEUE_FAILURE.TRANSIENT
		default:
			return error.failure satisfies never
	}
}

// CAP-021-R36, CAP-021-R39, CAP-021-S27, CAP-021-S29, ADR-050 bod 10, backend.md 3.2
@Injectable()
export class BinaryUploadService extends UploadTaskLoop<typeof UPLOAD_JOB_KIND.BINARY_UPLOAD, DurableBinaryStorePort> {
	protected readonly logger = new Logger(BinaryUploadService.name)
	protected readonly kind = UPLOAD_JOB_KIND.BINARY_UPLOAD

	constructor(
		database: DatabaseService,
		tasks: UploadTaskRepository,
		alerts: UploadAlertRepository,
		audit: AuditRepository,
		private readonly files: FileBinaryRepository,
		private readonly stores: DurableBinaryStoreService,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {
		super(database, tasks, alerts, audit)
	}

	protected async prepare(): Promise<DurableBinaryStorePort | undefined> {
		return await this.stores.current()
	}

	protected async handle(task: ClaimedUploadTask, store: DurableBinaryStorePort): Promise<void> {
		const file = await this.files.find(task.objectKind, task.objectId)
		if (file === undefined) {
			await this.complete(task)
			this.logger.warn(`Task ${task.id} found no ${task.objectKind} ${task.objectId} to upload`)
			return
		}
		const ownerReference = file.ownerReference
		if (ownerReference === undefined) {
			await this.failWithAlert(task, file, UPLOAD_ALERT_KIND.UPLOAD_FAILED, uploadFailureMessageOf(file))
			this.logger.error(`The ${file.kind} ${file.fileId} has no encounter in the clinical record (task ${task.id})`)
			return
		}
		try {
			const placement = { contentType: UPLOADED_CONTENT_TYPE[file.kind], ownerReference }
			for (const rendition of renditionsOf(file)) {
				await this.confirmed(rendition, placement, store)
			}
		} catch (error) {
			await this.settleFailure(task, file, error)
			return
		}
		await this.complete(task, (tx) => this.enqueueResourceWrite(tx, file))
		this.logger.log(`Uploaded ${file.kind} ${file.fileId} to the clinical record (task ${task.id})`)
	}

	// CAP-021-R36, CAP-021-S29
	private async confirmed(
		rendition: StoredRendition,
		placement: BinaryPlacement,
		store: DurableBinaryStorePort,
	): Promise<void> {
		if (rendition.isUploaded) {
			return
		}
		if (
			rendition.clinicalRecordBinaryId !== null &&
			(await store.sha256Of(rendition.clinicalRecordBinaryId)) === rendition.sha256
		) {
			await this.files.confirmUpload(rendition.binaryObjectId)
			return
		}
		if (!(await this.binaryStore.exists(rendition.binaryObjectId))) {
			throw new MissingBufferError(rendition.binaryObjectId)
		}
		const content = await this.binaryStore.get(rendition.binaryObjectId)
		const binaryId = await store.upload(content, placement)
		await this.files.rememberBinaryId(rendition.binaryObjectId, binaryId)
		const kept = await store.sha256Of(binaryId)
		if (kept === undefined) {
			throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, `binary ${binaryId} cannot be read back yet`)
		}
		await this.verified(rendition, binaryId, kept)
	}

	private async verified(rendition: StoredRendition, binaryId: string, keptSha256: string): Promise<void> {
		if (keptSha256 !== rendition.sha256) {
			throw new DigestMismatchError(rendition.binaryObjectId, binaryId)
		}
		await this.files.confirmUpload(rendition.binaryObjectId)
	}

	// CAP-021-R37, datovy-model.md 4, queue_task_open_uniq
	private async enqueueResourceWrite(tx: postgres.TransactionSql, file: FileBinaries): Promise<void> {
		await this.queue.enqueue(tx, { kind: JOB_KIND.CLINICAL_RECORD_WRITE, objectKind: file.kind, objectId: file.fileId })
	}

	// CAP-021-R36, CAP-021-R27, CAP-021-S27
	private async settleFailure(task: ClaimedUploadTask, file: FileBinaries, error: unknown): Promise<void> {
		const subject = `${file.kind} ${file.fileId} (task ${task.id})`
		const step = await this.settleFailedAttempt(task, uploadFailureOf(error), async () => {
			await this.failWithAlert(task, file, UPLOAD_ALERT_KIND.UPLOAD_FAILED, uploadFailureMessageOf(file))
		})
		switch (step.kind) {
			case FAILED_ATTEMPT_STEP.FAIL:
			case FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES:
				this.logger.error(`Uploading ${subject} failed for good: ${String(error)}`)
				return
			case FAILED_ATTEMPT_STEP.RETRY_LATER:
			case FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME:
				this.logger.warn(`Uploading ${subject} waits ${step.delayMilliseconds} ms: ${String(error)}`)
				return
			default:
				step satisfies never
		}
	}
}
