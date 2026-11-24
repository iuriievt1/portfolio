import { Module } from "@nestjs/common"
import { ImplementationIdentityService } from "./implementation-identity.service"
import { PacsSettingsService } from "./pacs-settings.service"

// CAP-023-R02, CAP-012-R17, ADR-035 bod 4
@Module({
	providers: [ImplementationIdentityService, PacsSettingsService],
	exports: [ImplementationIdentityService, PacsSettingsService],
})
export class PacsModule {}
