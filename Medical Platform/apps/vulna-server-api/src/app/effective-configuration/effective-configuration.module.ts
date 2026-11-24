import { Module } from "@nestjs/common"
import { HpkeModule } from "../../libs/hpke/hpke.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { LoginMethodOverridesRepository } from "./repositories/login-method-overrides.repository"
import { EffectiveConfigurationService } from "./services/effective-configuration.service"

@Module({
	imports: [ConfigurationModule, HpkeModule],
	providers: [LoginMethodOverridesRepository, EffectiveConfigurationService],
	exports: [EffectiveConfigurationService, LoginMethodOverridesRepository],
})
export class EffectiveConfigurationModule {}
