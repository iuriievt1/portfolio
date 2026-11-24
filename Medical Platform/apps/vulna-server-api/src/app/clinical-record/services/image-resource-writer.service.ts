import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { ImageResourceTaskRepository } from "../repositories/image-resource-task.repository"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { FileResourceContentService } from "./file-resource-content.service"
import { FileResourceWriter } from "./file-resource-writer"

// CAP-021-R37, CAP-021-S30
@Injectable()
export class ImageResourceWriterService extends FileResourceWriter {
	protected readonly logger = new Logger(ImageResourceWriterService.name)
	protected readonly kind = JOB_OBJECT_KIND.IMAGE

	constructor(
		tasks: ImageResourceTaskRepository,
		stores: ClinicalRecordStoreService,
		content: FileResourceContentService,
	) {
		super(tasks, stores, content)
	}
}
