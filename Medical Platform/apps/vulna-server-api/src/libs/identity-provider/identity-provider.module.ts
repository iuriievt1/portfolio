import type { IdentityProviderPort } from "@ansora/core-server"
import { OidcIdentityProvider } from "@ansora/vulna-adapter-oidc"
import { Module } from "@nestjs/common"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"
import { DependencyStateModule } from "../dependency-state/dependency-state.module"
import { DependencyStateService } from "../dependency-state/dependency-state.service"
import { ObservedIdentityProvider } from "./observed-identity-provider"

export const IDENTITY_PROVIDER = Symbol("IdentityProvider")

// CAP-004-R07
export const ADMINISTRATION_IDENTITY_PROVIDER = Symbol("AdministrationIdentityProvider")

function identityProvider(
	env: EnvVariableService,
	dependencies: DependencyStateService,
	redirectUri: EnvVariable,
): IdentityProviderPort {
	const provider = new OidcIdentityProvider({
		issuer: env.get(EnvVariable.OIDC_ISSUER),
		clientId: env.get(EnvVariable.OIDC_CLIENT_ID),
		clientSecret: env.get(EnvVariable.OIDC_CLIENT_SECRET),
		redirectUri: env.get(redirectUri),
		scopes: env.getOptional(EnvVariable.OIDC_SCOPES),
	})
	return new ObservedIdentityProvider(provider, dependencies.identityProvider)
}

@Module({
	imports: [DependencyStateModule],
	providers: [
		{
			provide: IDENTITY_PROVIDER,
			inject: [EnvVariableService, DependencyStateService],
			useFactory: (env: EnvVariableService, dependencies: DependencyStateService) =>
				identityProvider(env, dependencies, EnvVariable.OIDC_REDIRECT_URI),
		},
		{
			provide: ADMINISTRATION_IDENTITY_PROVIDER,
			inject: [EnvVariableService, DependencyStateService],
			useFactory: (env: EnvVariableService, dependencies: DependencyStateService) =>
				identityProvider(env, dependencies, EnvVariable.OIDC_ADMINISTRATION_REDIRECT_URI),
		},
	],
	exports: [IDENTITY_PROVIDER, ADMINISTRATION_IDENTITY_PROVIDER],
})
export class IdentityProviderModule {}
