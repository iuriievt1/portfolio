import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AdministratorAlertDataModule } from "./administrator-alert-data.module"
import { MonitoringController } from "./controllers/monitoring.controller"
import { SurveillanceController } from "./controllers/surveillance.controller"
import { ClinicalRecordWriteTaskRepository } from "./repositories/clinical-record-write-task.repository"
import { OperationalMetricsRepository } from "./repositories/operational-metrics.repository"
import { AdministratorAlertService } from "./services/administrator-alert.service"
import { AdministratorAlertAcknowledgementService } from "./services/administrator-alert-acknowledgement.service"
import { ClinicalRecordWriteRequeueService } from "./services/clinical-record-write-requeue.service"
import { OperationalMetricsService } from "./services/operational-metrics.service"
import { StoreOutageAlertService } from "./services/store-outage-alert.service"
import { StoreOutageScheduler } from "./services/store-outage-scheduler.service"
import { SurveillanceService } from "./services/surveillance.service"
import { SurveillanceAccessService } from "./services/surveillance-access.service"

// CAP-028-R05, CAP-028-R09, CAP-028-R13, CAP-028-R15, CAP-028-R22, CAP-021-R27, CAP-023-R12
@Module({
	imports: [
		AdministrationSessionModule,
		AuditModule,
		ConfigurationModule,
		AdministratorAlertDataModule,
		ClinicalRecordModule,
		DependencyStateModule,
	],
	controllers: [MonitoringController, SurveillanceController],
	providers: [
		ClinicalRecordWriteTaskRepository,
		AdministratorAlertService,
		AdministratorAlertAcknowledgementService,
		ClinicalRecordWriteRequeueService,
		OperationalMetricsRepository,
		OperationalMetricsService,
		StoreOutageAlertService,
		StoreOutageScheduler,
		SurveillanceAccessService,
		SurveillanceService,
	],
})
export class MonitoringModule {}
