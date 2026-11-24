import { Global, Module } from "@nestjs/common"
import { ConfigurationRepository } from "./configuration.repository"
import { ConfigurationService } from "./configuration.service"

@Global()
@Module({
	providers: [ConfigurationRepository, ConfigurationService],
	exports: [ConfigurationService],
})
export class ConfigurationModule {}
