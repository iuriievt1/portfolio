import { Global, Module } from "@nestjs/common"
import { AuditModule } from "../audit/audit.module"
import { UserIdentityModule } from "../login/user-identity.module"
import { AdministrationSessionRepository } from "./repositories/administration-session.repository"
import { AdministrationSessionService } from "./services/administration-session.service"

@Global()
@Module({
	imports: [AuditModule, UserIdentityModule],
	providers: [AdministrationSessionRepository, AdministrationSessionService],
	exports: [AdministrationSessionService],
})
export class AdministrationSessionModule {}
