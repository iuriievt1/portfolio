import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { CodeListModule } from "../code-list/code-list.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { ImageModule } from "../image/image.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { RegistryModule } from "../registry/registry.module"
import { FindingController } from "./controllers/finding.controller"
import { AssessmentRepository } from "./repositories/assessment.repository"
import { BodySiteRepository } from "./repositories/body-site.repository"
import { FindingRepository } from "./repositories/finding.repository"
import { FindingHistoryRepository } from "./repositories/finding-history.repository"
import { WoundTypeChangeRepository } from "./repositories/wound-type-change.repository"
import { DraftAssessmentService } from "./services/draft-assessment.service"
import { FindingHistoryService } from "./services/finding-history.service"
import { FindingLocationService } from "./services/finding-location.service"
import { FindingWoundTypeService } from "./services/finding-wound-type.service"
import { FindingWoundTypeChangeService } from "./services/finding-wound-type-change.service"
import { PatientFindingsService } from "./services/patient-findings.service"

// CAP-016, CAP-020-R01, CAP-020-R13, CAP-020-R21
@Module({
	imports: [
		AuditModule,
		ClinicalRecordModule,
		CodeListModule,
		ConfigurationModule,
		DeviceModule,
		ImageModule,
		LoginModule,
		RegistryModule,
		UserIdentityModule,
	],
	controllers: [FindingController],
	providers: [
		AssessmentRepository,
		BodySiteRepository,
		FindingRepository,
		FindingHistoryRepository,
		WoundTypeChangeRepository,
		DraftAssessmentService,
		FindingHistoryService,
		FindingLocationService,
		FindingWoundTypeService,
		FindingWoundTypeChangeService,
		PatientFindingsService,
	],
	exports: [
		AssessmentRepository,
		BodySiteRepository,
		FindingRepository,
		DraftAssessmentService,
		FindingLocationService,
		FindingWoundTypeService,
	],
})
export class FindingModule {}
