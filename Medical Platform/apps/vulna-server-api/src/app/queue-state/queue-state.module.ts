import { Module } from "@nestjs/common"
import { AcquisitionModule } from "../acquisition/acquisition.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { UserSessionGuard } from "../login/guards/user-session.guard"
import { LoginModule } from "../login/login.module"
import { QueueStateController } from "./controllers/queue-state.controller"
import { QueueCallerGuard } from "./guards/queue-caller.guard"
import { QueueReportRepository } from "./repositories/queue-report.repository"
import { QueueStateRepository } from "./repositories/queue-state.repository"
import { QueueStateService } from "./services/queue-state.service"

// CAP-019-R08, CAP-019-R30
@Module({
	imports: [AcquisitionModule, ConfigurationModule, DeviceModule, LoginModule],
	controllers: [QueueStateController],
	providers: [UserSessionGuard, QueueCallerGuard, QueueStateRepository, QueueReportRepository, QueueStateService],
})
export class QueueStateModule {}
