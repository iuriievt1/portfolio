import { Module } from "@nestjs/common"
import { AcquisitionModule } from "../acquisition/acquisition.module"
import { AdministrationSessionModule } from "../administration-session/administration-session.module"
import { AuditModule } from "../audit/audit.module"
import { BinaryObjectModule } from "../binary-object/binary-object.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { EncounterModule } from "../encounter/encounter.module"
import { OperatorNotificationModule } from "../operator-notification/operator-notification.module"
import { RegistryModule } from "../registry/registry.module"
import { DraftAdministrationController } from "./controllers/draft-administration.controller"
import { AdministeredDraftRepository } from "./repositories/administered-draft.repository"
import { DraftDiscardConsentRepository } from "./repositories/draft-discard-consent.repository"
import { OperatorPresenceRepository } from "./repositories/operator-presence.repository"
import { AcquisitionDraftSearchService } from "./services/acquisition-draft-search.service"
import { DraftDiscardConsentService } from "./services/draft-discard-consent.service"

// CAP-004-R14, CAP-015-R19, CAP-015-R20
@Module({
	imports: [
		AcquisitionModule,
		AdministrationSessionModule,
		AuditModule,
		BinaryObjectModule,
		ConfigurationModule,
		EncounterModule,
		OperatorNotificationModule,
		RegistryModule,
	],
	controllers: [DraftAdministrationController],
	providers: [
		AdministeredDraftRepository,
		OperatorPresenceRepository,
		DraftDiscardConsentRepository,
		AcquisitionDraftSearchService,
		DraftDiscardConsentService,
	],
})
export class DraftAdministrationModule {}
