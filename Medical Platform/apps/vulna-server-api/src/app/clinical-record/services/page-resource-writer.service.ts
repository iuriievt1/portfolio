import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { PageResourceTaskRepository } from "../repositories/page-resource-task.repository"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { FileResourceContentService } from "./file-resource-content.service"
import { FileResourceWriter } from "./file-resource-writer"

// CAP-021-R37, CAP-021-S35
@Injectable()
export class PageResourceWriterService extends FileResourceWriter {
	protected readonly logger = new Logger(PageResourceWriterService.name)
	protected readonly kind = JOB_OBJECT_KIND.DOCUMENT_PAGE

	constructor(
		tasks: PageResourceTaskRepository,
		stores: ClinicalRecordStoreService,
		content: FileResourceContentService,
	) {
		super(tasks, stores, content)
	}
}
