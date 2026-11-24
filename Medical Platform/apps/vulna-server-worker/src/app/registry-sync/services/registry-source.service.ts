import type { RegistrySourcePort } from "@ansora/vulna-domain"
import { Inject, Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { PacsSettingsService } from "../../../libs/pacs/pacs-settings.service"
import { REGISTRY_SOURCE_FACTORY } from "../constants/registry-sync.constants"
import type { RegistrySourceFactory } from "../types/registry-sync.types"

// ADR-003 ř. 27, ADR-035 bod 2, ADR-035 bod 4
@Injectable()
export class RegistrySourceService {
	constructor(
		private readonly configuration: ConfigurationService,
		private readonly pacs: PacsSettingsService,
		@Inject(REGISTRY_SOURCE_FACTORY) private readonly sourceFor: RegistrySourceFactory,
	) {}

	async current(): Promise<RegistrySourcePort | undefined> {
		const settings = this.pacs.dimseSettingsOf(await this.configuration.effectiveValues())
		return settings === undefined ? undefined : this.sourceFor(settings)
	}
}
