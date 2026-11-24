import { Module } from "@nestjs/common"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceRequestLimitService } from "./services/device-request-limit.service"
import { RequestRateService } from "./services/request-rate.service"

@Module({
	imports: [ConfigurationModule],
	providers: [RequestRateService, DeviceRequestLimitService],
	exports: [RequestRateService, DeviceRequestLimitService],
})
export class RequestRateModule {}
