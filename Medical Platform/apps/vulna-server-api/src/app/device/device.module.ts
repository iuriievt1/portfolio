import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { EffectiveConfigurationModule } from "../effective-configuration/effective-configuration.module"
import { DeviceController } from "./controllers/device.controller"
import { DeviceAdministrationController } from "./controllers/device-administration.controller"
import { DeviceRepository } from "./repositories/device.repository"
import { DeviceAdministrationRepository } from "./repositories/device-administration.repository"
import { DeviceGroupRepository } from "./repositories/device-group.repository"
import { RecordedDeviceEventRepository } from "./repositories/recorded-device-event.repository"
import { DeviceService } from "./services/device.service"
import { DeviceAdministrationService } from "./services/device-administration.service"
import { DeviceEventService } from "./services/device-event.service"
import { DeviceIntegrityService } from "./services/device-integrity.service"
import { DeviceProofService } from "./services/device-proof.service"
import { DeviceSessionsService } from "./services/device-sessions.service"
import { DeviceTokenService } from "./services/device-token.service"
import { DpopNonceService } from "./services/dpop-nonce.service"

@Module({
	imports: [AuditModule, ConfigurationModule, EffectiveConfigurationModule],
	controllers: [DeviceController, DeviceAdministrationController],
	providers: [
		DeviceRepository,
		DeviceAdministrationRepository,
		DeviceGroupRepository,
		RecordedDeviceEventRepository,
		DeviceProofService,
		DpopNonceService,
		DeviceTokenService,
		DeviceService,
		DeviceAdministrationService,
		DeviceEventService,
		DeviceIntegrityService,
		DeviceSessionsService,
	],
	exports: [DeviceProofService, DeviceTokenService, DpopNonceService],
})
export class DeviceModule {}
