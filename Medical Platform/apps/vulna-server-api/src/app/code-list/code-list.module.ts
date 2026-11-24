import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { LocalizationModule } from "../localization/localization.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { CodeListDataModule } from "./code-list-data.module"
import { BodyDiagramController } from "./controllers/body-diagram.controller"
import { CodeListController } from "./controllers/code-list.controller"
import { CodeListAdministrationController } from "./controllers/code-list-administration.controller"
import { CodeListService } from "./services/code-list.service"
import { CodeListAdministrationService } from "./services/code-list-administration.service"
import { CodeListChoiceService } from "./services/code-list-choice.service"

// CAP-016, CAP-017, CAP-024
@Module({
	imports: [
		AuditModule,
		ClinicalRecordModule,
		CodeListDataModule,
		ConfigurationModule,
		DeviceModule,
		LocalizationModule,
		LoginModule,
		UserIdentityModule,
	],
	controllers: [CodeListController, BodyDiagramController, CodeListAdministrationController],
	providers: [CodeListService, CodeListAdministrationService, CodeListChoiceService],
	exports: [CodeListChoiceService],
})
export class CodeListModule {}
