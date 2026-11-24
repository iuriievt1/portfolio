import { CONFIGURATION_KEY, integerValueOf, requiredIntegerOf } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { RegistrySyncSettings } from "../types/registry-sync.types"

// CAP-024-R04, konfigurace-a-profily.md 2.1
@Injectable()
export class RegistrySyncSettingsService {
	constructor(private readonly configuration: ConfigurationService) {}

	async current(): Promise<RegistrySyncSettings> {
		const values = await this.configuration.effectiveValues()
		return {
			daysBack: requiredIntegerOf(values, CONFIGURATION_KEY.REGISTRY_WINDOW_DAYS_BACK),
			daysAhead: requiredIntegerOf(values, CONFIGURATION_KEY.REGISTRY_WINDOW_DAYS_AHEAD),
			periodSeconds: integerValueOf(values, CONFIGURATION_KEY.REGISTRY_SYNC_PERIOD_SECONDS),
		}
	}
}
