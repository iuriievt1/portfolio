import { Module } from "@nestjs/common"
import { AuditModule } from "../libs/audit/audit.module"
import { BinaryStoreModule } from "../libs/binary-store/binary-store.module"
import { CommonModule } from "../libs/common/common.module"
import { ConfigurationModule } from "../libs/configuration/configuration.module"
import { DatabaseModule } from "../libs/database/database.module"
import { ProfileModule } from "../libs/profile/profile.module"
import { AssemblyModule } from "./assembly/assembly.module"
import { AuditExportModule } from "./audit-export/audit-export.module"
import { ClinicalRecordUploadModule } from "./clinical-record-upload/clinical-record-upload.module"
import { DeliveryModule } from "./delivery/delivery.module"
import { DraftReminderModule } from "./draft-reminder/draft-reminder.module"
import { OrphanCleanupModule } from "./orphan-cleanup/orphan-cleanup.module"
import { RegistrySyncModule } from "./registry-sync/registry-sync.module"
import { RetentionModule } from "./retention/retention.module"
import { SurveillanceModule } from "./surveillance/surveillance.module"
import { TextRecognitionModule } from "./text-recognition/text-recognition.module"

@Module({
	imports: [
		CommonModule,
		DatabaseModule,
		ProfileModule,
		ConfigurationModule,
		AuditModule,
		BinaryStoreModule,
		AuditExportModule,
		RegistrySyncModule,
		DraftReminderModule,
		ClinicalRecordUploadModule,
		TextRecognitionModule,
		AssemblyModule,
		DeliveryModule,
		RetentionModule,
		OrphanCleanupModule,
		SurveillanceModule,
	],
})
export class AppModule {}
