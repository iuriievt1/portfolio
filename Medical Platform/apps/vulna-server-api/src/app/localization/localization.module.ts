import { Module } from "@nestjs/common"
import { ConfigurationModule } from "../configuration/configuration.module"
import { LocalizationService } from "./localization.service"

@Module({
	imports: [ConfigurationModule],
	providers: [LocalizationService],
	exports: [LocalizationService],
})
export class LocalizationModule {}
