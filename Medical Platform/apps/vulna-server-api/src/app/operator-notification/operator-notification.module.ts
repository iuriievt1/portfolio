import { Module } from "@nestjs/common"
import { DeviceModule } from "../device/device.module"
import { LoginModule } from "../login/login.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { OperatorNotificationController } from "./controllers/operator-notification.controller"
import { OperatorNotificationRepository } from "./repositories/operator-notification.repository"
import { OperatorNotificationService } from "./services/operator-notification.service"

// CAP-015-R18, CAP-015-R20, CAP-026-R16
@Module({
	imports: [DeviceModule, LoginModule, UserIdentityModule],
	controllers: [OperatorNotificationController],
	providers: [OperatorNotificationRepository, OperatorNotificationService],
	exports: [OperatorNotificationRepository],
})
export class OperatorNotificationModule {}
