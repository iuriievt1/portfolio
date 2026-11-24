import { Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { CodeListDataModule } from "../code-list/code-list-data.module"
import { ConfigurationController } from "./controllers/configuration.controller"
import { ConfigurationRepository } from "./repositories/configuration.repository"
import { ConfigurationService } from "./services/configuration.service"

@Module({
	imports: [AuditModule, CodeListDataModule],
	controllers: [ConfigurationController],
	providers: [ConfigurationRepository, ConfigurationService],
	exports: [ConfigurationService],
})
export class ConfigurationModule {}
