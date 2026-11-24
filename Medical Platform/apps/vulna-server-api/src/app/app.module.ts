import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { CommonModule } from "../libs/common/common.module"
import { DatabaseModule } from "../libs/database/database.module"
import { ProfileModule } from "../libs/profile/profile.module"
import { AcquisitionModule } from "./acquisition/acquisition.module"
import { AcquisitionAdministrationModule } from "./acquisition-administration/acquisition-administration.module"
import { AcquisitionDetailModule } from "./acquisition-detail/acquisition-detail.module"
import { AdministrationSessionModule } from "./administration-session/administration-session.module"
import { AuditAdministrationModule } from "./audit/audit-administration.module"
import { ClinicalRecordModule } from "./clinical-record/clinical-record.module"
import { CodeListModule } from "./code-list/code-list.module"
import { ConfigurationModule } from "./configuration/configuration.module"
import { DeliveryMonitoringModule } from "./delivery-monitoring/delivery-monitoring.module"
import { DeviceModule } from "./device/device.module"
import { DocumentModule } from "./document/document.module"
import { DraftAdministrationModule } from "./draft-administration/draft-administration.module"
import { EffectiveConfigurationModule } from "./effective-configuration/effective-configuration.module"
import { EncounterModule } from "./encounter/encounter.module"
import { FindingModule } from "./finding/finding.module"
import { ImageModule } from "./image/image.module"
import { HealthController } from "./infra/controllers/health.controller"
import { ProblemJsonFilter } from "./infra/filters/problem-json.filter"
import { AppVersionGuard } from "./infra/guards/app-version.guard"
import { RequestRateGuard } from "./infra/guards/request-rate.guard"
import { DpopNonceMiddleware, EVERY_ROUTE } from "./infra/middleware/dpop-nonce.middleware"
import { RequestContextMiddleware } from "./infra/middleware/request-context.middleware"
import { LocalizationModule } from "./localization/localization.module"
import { LoginModule } from "./login/login.module"
import { MonitoringModule } from "./monitoring/monitoring.module"
import { OperatorNotificationModule } from "./operator-notification/operator-notification.module"
import { OrphanedObjectModule } from "./orphaned-object/orphaned-object.module"
import { QueueStateModule } from "./queue-state/queue-state.module"
import { RecentPatientsModule } from "./recent-patients/recent-patients.module"
import { RegistryModule } from "./registry/registry.module"
import { RequestRateModule } from "./request-rate/request-rate.module"

// architektura.md 2
@Module({
	imports: [
		CommonModule,
		DatabaseModule,
		ProfileModule,
		AdministrationSessionModule,
		ConfigurationModule,
		EffectiveConfigurationModule,
		LocalizationModule,
		DeviceModule,
		LoginModule,
		AcquisitionModule,
		CodeListModule,
		EncounterModule,
		FindingModule,
		AcquisitionDetailModule,
		DocumentModule,
		ImageModule,
		RegistryModule,
		AuditAdministrationModule,
		ClinicalRecordModule,
		MonitoringModule,
		DeliveryMonitoringModule,
		OrphanedObjectModule,
		DraftAdministrationModule,
		AcquisitionAdministrationModule,
		OperatorNotificationModule,
		QueueStateModule,
		RequestRateModule,
		RecentPatientsModule,
	],
	controllers: [HealthController],
	providers: [
		{ provide: APP_GUARD, useClass: RequestRateGuard },
		{ provide: APP_GUARD, useClass: AppVersionGuard },
		{ provide: APP_FILTER, useClass: ProblemJsonFilter },
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RequestContextMiddleware, DpopNonceMiddleware).forRoutes(EVERY_ROUTE)
	}
}
