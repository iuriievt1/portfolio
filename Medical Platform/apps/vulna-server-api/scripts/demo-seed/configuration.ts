import { AuditRepository } from "../../src/app/audit/repositories/audit.repository"
import { CodeListRepository } from "../../src/app/code-list/repositories/code-list.repository"
import { CodeListSetRepository } from "../../src/app/code-list/repositories/code-list-set.repository"
import { ConfigurationRepository } from "../../src/app/configuration/repositories/configuration.repository"
import { ConfigurationService } from "../../src/app/configuration/services/configuration.service"
import type { DatabaseService } from "../../src/libs/database/database.service"
import { ProfileService } from "../../src/libs/profile/profile.service"

export function configurationOf(database: DatabaseService): ConfigurationService {
	return new ConfigurationService(
		database,
		new ConfigurationRepository(database),
		new AuditRepository(),
		new ProfileService(),
		new CodeListRepository(),
		new CodeListSetRepository(),
	)
}
