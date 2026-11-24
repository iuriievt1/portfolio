import { Module } from "@nestjs/common"
import { IdentityProviderModule } from "../../libs/identity-provider/identity-provider.module"
import { QrCodeModule } from "../../libs/qr-code/qr-code.module"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { DeviceModule } from "../device/device.module"
import { EffectiveConfigurationModule } from "../effective-configuration/effective-configuration.module"
import { LocalizationModule } from "../localization/localization.module"
import { AdministrationLoginController } from "./controllers/administration-login.controller"
import { AdministrationSessionController } from "./controllers/administration-session.controller"
import { CardBindingController } from "./controllers/card-binding.controller"
import { CardBindingAdministrationController } from "./controllers/card-binding-administration.controller"
import { LanguagePreferenceController } from "./controllers/language-preference.controller"
import { LoginController } from "./controllers/login.controller"
import { OidcReturnController } from "./controllers/oidc-return.controller"
import { SessionController } from "./controllers/session.controller"
import { UserAdministrationController } from "./controllers/user-administration.controller"
import { AdministrationLoginFlowRepository } from "./repositories/administration-login-flow.repository"
import { CardRepository } from "./repositories/card.repository"
import { LoginAttemptRepository } from "./repositories/login-attempt.repository"
import { LoginChallengeRepository } from "./repositories/login-challenge.repository"
import { LoginFlowRepository } from "./repositories/login-flow.repository"
import { RoleRepository } from "./repositories/role.repository"
import { SessionRepository } from "./repositories/session.repository"
import { UserDeviceCredentialRepository } from "./repositories/user-device-credential.repository"
import { AdministrationLoginService } from "./services/administration-login.service"
import { CardBindingService } from "./services/card-binding.service"
import { CardIdentityService } from "./services/card-identity.service"
import { CarrierRevocationService } from "./services/carrier-revocation.service"
import { LanguagePreferenceService } from "./services/language-preference.service"
import { LoginAttemptService } from "./services/login-attempt.service"
import { LoginChallengeService } from "./services/login-challenge.service"
import { OidcLoginService } from "./services/oidc-login.service"
import { QuickLoginService } from "./services/quick-login.service"
import { SessionService } from "./services/session.service"
import { SessionLifecycleService } from "./services/session-lifecycle.service"
import { UserAdministrationService } from "./services/user-administration.service"
import { UserRevocationService } from "./services/user-revocation.service"
import { UserIdentityModule } from "./user-identity.module"

@Module({
	imports: [
		AuditModule,
		ClinicalRecordModule,
		ConfigurationModule,
		DeviceModule,
		EffectiveConfigurationModule,
		IdentityProviderModule,
		LocalizationModule,
		QrCodeModule,
		UserIdentityModule,
	],
	controllers: [
		LoginController,
		OidcReturnController,
		SessionController,
		LanguagePreferenceController,
		CardBindingController,
		CardBindingAdministrationController,
		UserAdministrationController,
		AdministrationLoginController,
		AdministrationSessionController,
	],
	providers: [
		AdministrationLoginFlowRepository,
		CardRepository,
		LoginAttemptRepository,
		LoginChallengeRepository,
		LoginFlowRepository,
		RoleRepository,
		SessionRepository,
		UserDeviceCredentialRepository,
		LoginAttemptService,
		LoginChallengeService,
		SessionService,
		SessionLifecycleService,
		CardIdentityService,
		OidcLoginService,
		QuickLoginService,
		CardBindingService,
		LanguagePreferenceService,
		UserAdministrationService,
		CarrierRevocationService,
		UserRevocationService,
		AdministrationLoginService,
	],
	exports: [SessionService, SessionRepository],
})
export class LoginModule {}
