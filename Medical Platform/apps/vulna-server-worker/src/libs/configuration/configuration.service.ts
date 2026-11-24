import { type ConfigurationValues, effectiveEntries } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { ProfileService } from "../profile/profile.service"
import { ConfigurationRepository } from "./configuration.repository"

// CAP-012-R19
@Injectable()
export class ConfigurationService {
	constructor(
		private readonly repository: ConfigurationRepository,
		private readonly profile: ProfileService,
	) {}

	async effectiveValues(): Promise<ConfigurationValues> {
		return new Map(effectiveEntries(this.profile.configurationSchema, await this.repository.latestEntries()))
	}
}
