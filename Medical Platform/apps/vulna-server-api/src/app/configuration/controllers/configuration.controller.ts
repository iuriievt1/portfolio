import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { type ConfigurationChangeInput, configurationChangeSchema } from "../dto/configuration-change.input.dto"
import { ConfigurationService } from "../services/configuration.service"
import type { Configuration, ConfigurationSaveResult } from "../types/configuration.types"

@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@RequiresPermission(PERMISSION.CONFIGURATION_MANAGE)
@Controller(`${ADMIN_API_BASE_PATH}/configuration`)
export class ConfigurationController {
	constructor(private readonly configuration: ConfigurationService) {}

	@Get()
	async read(): Promise<Configuration> {
		return await this.configuration.read()
	}

	@Patch()
	async update(
		@Body(new ZodValidationPipe(configurationChangeSchema)) change: ConfigurationChangeInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<ConfigurationSaveResult> {
		return await this.configuration.update(change, administrator)
	}
}
