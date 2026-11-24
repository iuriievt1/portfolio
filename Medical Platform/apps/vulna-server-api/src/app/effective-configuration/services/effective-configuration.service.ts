import { PATIENT_TAG_SOURCE } from "@ansora/contracts"
import {
	CARD_IDENTITY_MODE,
	CONFIGURATION_KEY,
	type ConfigurationKey,
	type ConfigurationValues,
	choiceValueOf,
	effectiveLoginMethods,
	enabledLoginMethods,
	type LoginMethod,
	textValueOf,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { HpkeKeyService } from "../../../libs/hpke/hpke-key.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { clinicalStepsOf } from "../../configuration/utils/clinical-steps"
import { LoginMethodOverridesRepository } from "../repositories/login-method-overrides.repository"
import type { DeviceLevels, EffectiveConfiguration } from "../types/effective-configuration.types"

const TAG_SOURCES = Object.values(PATIENT_TAG_SOURCE)

const INTEGER_FIELDS: readonly (readonly [IntegerField, ConfigurationKey])[] = [
	["pin_min_length", CONFIGURATION_KEY.PIN_MIN_LENGTH],
	["pin_attempts_limit", CONFIGURATION_KEY.PIN_ATTEMPTS_LIMIT],
	["pin_delay_seconds", CONFIGURATION_KEY.PIN_DELAY_SECONDS],
	["full_login_interval_seconds", CONFIGURATION_KEY.FULL_LOGIN_INTERVAL_SECONDS],
	["credential_attempts_limit", CONFIGURATION_KEY.CREDENTIAL_ATTEMPTS_LIMIT],
	["queue_max_items", CONFIGURATION_KEY.QUEUE_MAX_ITEMS],
	["max_draft_acquisitions", CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS],
	["draft_acquisition_reminder_seconds", CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS],
	["home_draft_acquisitions_max_rows", CONFIGURATION_KEY.HOME_DRAFT_ACQUISITIONS_MAX_ROWS],
	["scheduled_encounters_max_items", CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_MAX_ITEMS],
	["device_key_hold_seconds", CONFIGURATION_KEY.DEVICE_KEY_HOLD_SECONDS],
	["device_local_copy_seconds", CONFIGURATION_KEY.RETENTION_DEVICE_LOCAL_COPY_SECONDS],
	["low_storage_warning_bytes", CONFIGURATION_KEY.LOW_STORAGE_WARNING_BYTES],
	["acquisition_max_images", CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES],
	["acquisition_max_bytes", CONFIGURATION_KEY.ACQUISITION_MAX_BYTES],
	["document_max_pages", CONFIGURATION_KEY.DOCUMENT_MAX_PAGES],
]

@Injectable()
export class EffectiveConfigurationService {
	constructor(
		private readonly configuration: ConfigurationService,
		private readonly overrides: LoginMethodOverridesRepository,
		private readonly hpke: HpkeKeyService,
	) {}

	async forDevice(device: DeviceLevels): Promise<EffectiveConfiguration> {
		const { version, values } = await this.configuration.effective()
		const configuration: EffectiveConfiguration = {
			version,
			server_hpke_key: this.hpke.serverHpkeKey(),
			allowed_login_methods: await this.allowedLoginMethods(values, device),
		}
		for (const [field, key] of INTEGER_FIELDS) {
			const value = values.get(key)
			if (typeof value === "number" && Number.isInteger(value)) {
				configuration[field] = value
			}
		}
		const pinComplexity = values.get(CONFIGURATION_KEY.PIN_COMPLEXITY)
		if (typeof pinComplexity === "string") {
			configuration.pin_complexity = pinComplexity
		}
		const scheduledEncountersEnabled = values.get(CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED)
		if (typeof scheduledEncountersEnabled === "boolean") {
			configuration.scheduled_encounters_enabled = scheduledEncountersEnabled
		}
		const steps = clinicalStepsOf(values)
		configuration.wound_type_enabled = steps.woundType
		configuration.healing_phase_enabled = steps.healingPhase
		configuration.card_binding_offered =
			values.get(CONFIGURATION_KEY.CARD_IDENTITY_MODE) === CARD_IDENTITY_MODE.UID_BINDING
		const defaultLanguage = values.get(CONFIGURATION_KEY.DEFAULT_LANGUAGE)
		if (typeof defaultLanguage === "string") {
			configuration.default_language = defaultLanguage
		}
		const supportedLanguages = values.get(CONFIGURATION_KEY.SUPPORTED_LANGUAGES)
		if (Array.isArray(supportedLanguages)) {
			configuration.supported_languages = supportedLanguages.filter((language) => typeof language === "string")
		}
		configuration.patient_code = patientCodeOf(values)
		configuration.patient_tag = patientTagOf(values)
		return configuration
	}

	private async allowedLoginMethods(values: ConfigurationValues, device: DeviceLevels): Promise<LoginMethod[]> {
		const group = await this.overrides.ofGroup(device.groupCode)
		return enabledLoginMethods(effectiveLoginMethods({ installation: values, group, device: device.loginMethods }))
	}
}

// CAP-013-R03
function patientCodeOf(values: ConfigurationValues): EffectiveConfiguration["patient_code"] {
	const system = textValueOf(values, CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)
	if (system === undefined) {
		return null
	}
	const pattern = textValueOf(values, CONFIGURATION_KEY.PATIENT_CODE_PATTERN)
	return pattern === undefined ? { system } : { system, pattern }
}

// CAP-013-R05, CAP-013-S04
function patientTagOf(values: ConfigurationValues): EffectiveConfiguration["patient_tag"] {
	const source = choiceValueOf(values, CONFIGURATION_KEY.PATIENT_TAG_SOURCE, TAG_SOURCES)
	const system = textValueOf(values, CONFIGURATION_KEY.PATIENT_TAG_SYSTEM)
	return source === undefined || system === undefined ? null : { source, system }
}

type IntegerField = {
	[Key in keyof EffectiveConfiguration]-?: EffectiveConfiguration[Key] extends number | undefined ? Key : never
}[keyof EffectiveConfiguration]
