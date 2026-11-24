import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import {
	type BinaryStorePort,
	CONFIGURATION_KEY,
	requiredChoiceOf,
	requiredIntegerOf,
	retryDelayMilliseconds,
} from "@ansora/core-server"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { binaryObjectOf } from "../../../libs/binary-store/binary-object"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DatabaseService } from "../../../libs/database/database.service"
import {
	UPLOAD_ALERT_KIND,
	UPLOAD_JOB_KIND,
	VIEWING_COPY_FORMAT_JPEG,
} from "../constants/clinical-record-upload.constants"
import { FileBinaryRepository } from "../repositories/file-binary.repository"
import { UploadAlertRepository } from "../repositories/upload-alert.repository"
import { UploadTaskRepository } from "../repositories/upload-task.repository"
import type { ClaimedUploadTask, CopiedObjectKind, FileBinaries } from "../types/clinical-record-upload.types"
import { viewingCopyFailureMessageOf } from "../utils/upload-alert"
import type { ViewingCopySettings } from "../utils/viewing-copy"
import { UploadTaskLoop } from "./upload-task-loop"
import { ViewingCopyRendererService } from "./viewing-copy-renderer.service"

// CAP-021-R40, ADR-050 bod 13, backend.md 3.2
@Injectable()
export class ViewingCopyService extends UploadTaskLoop<typeof UPLOAD_JOB_KIND.VIEWING_COPY, ViewingCopySettings> {
	protected readonly logger = new Logger(ViewingCopyService.name)
	protected readonly kind = UPLOAD_JOB_KIND.VIEWING_COPY

	constructor(
		database: DatabaseService,
		tasks: UploadTaskRepository,
		alerts: UploadAlertRepository,
		audit: AuditRepository,
		private readonly files: FileBinaryRepository,
		private readonly configuration: ConfigurationService,
		private readonly renderer: ViewingCopyRendererService,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {
		super(database, tasks, alerts, audit)
	}

	// konfigurace-a-profily.md 2.1
	protected async prepare(): Promise<ViewingCopySettings> {
		const values = await this.configuration.effectiveValues()
		requiredChoiceOf(values, CONFIGURATION_KEY.VIEWING_COPY_FORMAT, [VIEWING_COPY_FORMAT_JPEG])
		return {
			maxLongEdgePx: requiredIntegerOf(values, CONFIGURATION_KEY.VIEWING_COPY_MAX_LONG_EDGE_PX),
			quality: requiredIntegerOf(values, CONFIGURATION_KEY.VIEWING_COPY_QUALITY),
		}
	}

	protected async handle(task: ClaimedUploadTask<CopiedObjectKind>, settings: ViewingCopySettings): Promise<void> {
		const file = await this.files.find(task.objectKind, task.objectId)
		if (file === undefined) {
			await this.complete(task)
			this.logger.warn(`Task ${task.id} found no ${task.objectKind} ${task.objectId} to copy`)
			return
		}
		if (file.viewingCopy !== undefined) {
			await this.complete(task)
			return
		}
		const original = await this.originalOf(task, file)
		if (original === undefined) {
			return
		}
		const copy = await this.copyOf(task, file, original, settings)
		if (copy === undefined) {
			return
		}
		const object = binaryObjectOf(copy)
		await this.binaryStore.put(object.binaryObjectId, Readable.from(copy))
		await this.complete(task, (tx) => this.files.attachViewingCopy(tx, file.kind, file.fileId, object))
		this.logger.log(`Made viewing copy ${object.binaryObjectId} of ${file.kind} ${file.fileId} (task ${task.id})`)
	}

	// CAP-021-R40, CAP-021-R35
	private async originalOf(
		task: ClaimedUploadTask<CopiedObjectKind>,
		file: FileBinaries<CopiedObjectKind>,
	): Promise<Uint8Array | undefined> {
		if (!(await this.binaryStore.exists(file.original.binaryObjectId))) {
			await this.failWithAlert(task, file, UPLOAD_ALERT_KIND.VIEWING_COPY_FAILED, viewingCopyFailureMessageOf(file))
			this.logger.error(`The buffer holds no original of ${file.kind} ${file.fileId} to copy (task ${task.id})`)
			return undefined
		}
		try {
			return await buffer(await this.binaryStore.get(file.original.binaryObjectId))
		} catch (error) {
			const delay = retryDelayMilliseconds(task.attempts)
			await this.queue.retryLater(task.id, delay)
			this.logger.warn(
				`The original of ${file.kind} ${file.fileId} waits ${delay} ms (task ${task.id}): ${String(error)}`,
			)
			return undefined
		}
	}

	// CAP-021-R40
	private async copyOf(
		task: ClaimedUploadTask<CopiedObjectKind>,
		file: FileBinaries<CopiedObjectKind>,
		original: Uint8Array,
		settings: ViewingCopySettings,
	): Promise<Buffer | undefined> {
		try {
			return await this.renderer.copyOf(original, settings)
		} catch (error) {
			await this.failWithAlert(task, file, UPLOAD_ALERT_KIND.VIEWING_COPY_FAILED, viewingCopyFailureMessageOf(file))
			this.logger.error(`The viewing copy of ${file.kind} ${file.fileId} failed (task ${task.id}): ${String(error)}`)
			return undefined
		}
	}
}
