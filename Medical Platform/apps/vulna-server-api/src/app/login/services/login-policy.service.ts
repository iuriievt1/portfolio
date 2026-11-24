import {
	CARD_IDENTITY_MODE,
	type CardIdentityMode,
	CONFIGURATION_KEY,
	optionalText,
	parseGroupToRoleMapping,
	requiredIntegerOf,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import type { LoginPolicy } from "../types/login-policy.types"

@Injectable()
export class LoginPolicyService {
	constructor(private readonly configuration: ConfigurationService) {}

	async current(): Promise<LoginPolicy> {
		const { version, values } = await this.configuration.effective()
		return {
			version,
			session: {
				sessionMaxSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.SESSION_MAX_SECONDS),
				tokenValiditySeconds: requiredIntegerOf(values, CONFIGURATION_KEY.TOKEN_VALIDITY_SECONDS),
			},
			idleLockSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.IDLE_LOCK_SECONDS),
			fullLoginIntervalSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.FULL_LOGIN_INTERVAL_SECONDS),
			pinAttemptsLimit: requiredIntegerOf(values, CONFIGURATION_KEY.PIN_ATTEMPTS_LIMIT),
			pinDelaySeconds: requiredIntegerOf(values, CONFIGURATION_KEY.PIN_DELAY_SECONDS),
			credentialAttemptsLimit: requiredIntegerOf(values, CONFIGURATION_KEY.CREDENTIAL_ATTEMPTS_LIMIT),
			cardIdentityMode: cardIdentityMode(values.get(CONFIGURATION_KEY.CARD_IDENTITY_MODE)),
			cardBindingCodeLifetimeSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.CARD_BINDING_CODE_LIFETIME_SECONDS),
			personalNumberClaim: optionalText(values.get(CONFIGURATION_KEY.PERSONAL_NUMBER_CLAIM)),
			loginNameClaim: optionalText(values.get(CONFIGURATION_KEY.LOGIN_NAME_CLAIM)),
			emailClaim: optionalText(values.get(CONFIGURATION_KEY.EMAIL_CLAIM)),
			groupClaim: optionalText(values.get(CONFIGURATION_KEY.GROUP_CLAIM)),
			authorizedGroup: optionalText(values.get(CONFIGURATION_KEY.AUTHORIZED_GROUP)),
			departmentClaim: optionalText(values.get(CONFIGURATION_KEY.DEPARTMENT_CLAIM)),
			groupToRole: parseGroupToRoleMapping(values.get(CONFIGURATION_KEY.GROUP_TO_ROLE)),
			administration: {
				idleLogoutSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.ADMINISTRATION_IDLE_LOGOUT_SECONDS),
				sessionMaxSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.ADMINISTRATION_SESSION_MAX_SECONDS),
			},
		}
	}
}

function cardIdentityMode(value: unknown): CardIdentityMode {
	const mode = Object.values(CARD_IDENTITY_MODE).find((candidate) => candidate === value)
	if (mode === undefined) {
		throw new Error(`configuration key ${CONFIGURATION_KEY.CARD_IDENTITY_MODE} is not a carrier identity mode`)
	}
	return mode
}
