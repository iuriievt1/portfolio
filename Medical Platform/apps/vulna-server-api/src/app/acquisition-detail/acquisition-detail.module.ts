import { Module } from "@nestjs/common"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { DeviceModule } from "../device/device.module"
import { EncounterModule } from "../encounter/encounter.module"
import { ImageModule } from "../image/image.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { AcquisitionDetailController } from "./controllers/acquisition-detail.controller"
import { DetailRecordRepository } from "./repositories/detail-record.repository"
import { AcquisitionDetailService } from "./services/acquisition-detail.service"

// CAP-020-R17, CAP-020-R19
@Module({
	imports: [
		ClinicalRecordModule,
		DeviceModule,
		EncounterModule,
		ImageModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [AcquisitionDetailController],
	providers: [DetailRecordRepository, AcquisitionDetailService],
})
export class AcquisitionDetailModule {}
