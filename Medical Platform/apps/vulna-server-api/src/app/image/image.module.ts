import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { DeviceModule } from "../device/device.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { DocumentPageController } from "./controllers/document-page.controller"
import { ImageController } from "./controllers/image.controller"
import { RecordFileRepository } from "./repositories/record-file.repository"
import { StoredFileRepository } from "./repositories/stored-file.repository"
import { FileReleaseService } from "./services/file-release.service"
import { RecordReleaseService } from "./services/record-release.service"

// CAP-020-R09, CAP-020-R22, CAP-025-R28
@Module({
	imports: [
		AuditModule,
		BinaryObjectModule,
		ClinicalRecordModule,
		DeviceModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [ImageController, DocumentPageController],
	providers: [RecordFileRepository, StoredFileRepository, FileReleaseService, RecordReleaseService],
	exports: [RecordFileRepository, RecordReleaseService],
})
export class ImageModule {}
