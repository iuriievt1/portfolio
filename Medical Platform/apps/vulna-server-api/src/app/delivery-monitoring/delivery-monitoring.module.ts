import { Module } from "@nestjs/common"
import { AssemblyTaskRepository } from "../acquisition/repositories/assembly-task.repository"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AdministratorAlertDataModule } from "../monitoring/administrator-alert-data.module"
import { DeliveryTargetController } from "./controllers/delivery-target.controller"
import { MonitoredDeliveryController } from "./controllers/monitored-delivery.controller"
import { DeliveryOverviewRepository } from "./repositories/delivery-overview.repository"
import { MonitoredDeliveryRepository } from "./repositories/monitored-delivery.repository"
import { DeliveryClosureService } from "./services/delivery-closure.service"
import { DeliveryOverviewService } from "./services/delivery-overview.service"
import { DeliveryTargetResumptionService } from "./services/delivery-target-resumption.service"
import { DeliveryVerificationResumptionService } from "./services/delivery-verification-resumption.service"
import { TextRecognitionRestartService } from "./services/text-recognition-restart.service"

// CAP-028-R12, CAP-023-R23, CAP-023-R26, CAP-023-R28, CAP-022-R15, CAP-028-R20
@Module({
	imports: [AdministrationSessionModule, AuditModule, ConfigurationModule, AdministratorAlertDataModule],
	controllers: [DeliveryTargetController, MonitoredDeliveryController],
	providers: [
		DeliveryOverviewRepository,
		MonitoredDeliveryRepository,
		AssemblyTaskRepository,
		DeliveryOverviewService,
		DeliveryClosureService,
		DeliveryTargetResumptionService,
		DeliveryVerificationResumptionService,
		TextRecognitionRestartService,
	],
})
export class DeliveryMonitoringModule {}
