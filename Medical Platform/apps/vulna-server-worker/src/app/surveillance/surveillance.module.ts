import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { ClinicalRecordUploadModule } from "../clinical-record-upload/clinical-record-upload.module"
import { SurveillanceController } from "./controllers/surveillance.controller"
import { SurveillanceService } from "./services/surveillance.service"

// CAP-028-R05, CAP-028-R06, CAP-028-R08, CAP-028-R09, CAP-028-R10
@Module({
	imports: [DependencyStateModule, ClinicalRecordUploadModule],
	controllers: [SurveillanceController],
	providers: [SurveillanceService],
})
export class SurveillanceModule {}
