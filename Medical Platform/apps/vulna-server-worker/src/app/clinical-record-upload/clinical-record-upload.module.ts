import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { FileBinaryRepository } from "./repositories/file-binary.repository"
import { UploadAlertRepository } from "./repositories/upload-alert.repository"
import { UploadTaskRepository } from "./repositories/upload-task.repository"
import { BinaryUploadService } from "./services/binary-upload.service"
import { DurableBinaryStoreService } from "./services/durable-binary-store.service"
import { ViewingCopyService } from "./services/viewing-copy.service"
import { ViewingCopyRendererService } from "./services/viewing-copy-renderer.service"

// CAP-021-R36, CAP-021-R40, backend.md 3.2
@Module({
	imports: [DependencyStateModule],
	providers: [
		UploadTaskRepository,
		UploadAlertRepository,
		FileBinaryRepository,
		DurableBinaryStoreService,
		ViewingCopyRendererService,
		ViewingCopyService,
		BinaryUploadService,
	],
	exports: [DurableBinaryStoreService],
})
export class ClinicalRecordUploadModule {}
