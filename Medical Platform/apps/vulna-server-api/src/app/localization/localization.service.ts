import { CONFIGURATION_KEY, textValueOf } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { SERVER_TEXTS, type ServerTexts } from "../../i18n"
import { ProfileService } from "../../libs/profile/profile.service"
import { ConfigurationService } from "../configuration/services/configuration.service"
import { type InstanceLanguages, responseLanguage, supportedLanguageOf } from "./response-language"
import type { NameLanguages } from "./types/localization.types"

// CAP-004-R13
const ADMINISTRATION_LANGUAGE = "cs"

export interface ResponseTexts {
	texts: ServerTexts
	contentLanguage: string
}

@Injectable()
export class LocalizationService {
	private readonly logger = new Logger(LocalizationService.name)

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly profile: ProfileService,
	) {}

	// CAP-015-R27
	async responseTexts(acceptLanguage: string | undefined): Promise<ResponseTexts> {
		const instance = await this.instanceLanguages()
		return this.textsIn(responseLanguage(acceptLanguage, instance), instance.defaultLanguage)
	}

	// CAP-017-R18, CAP-016-R18, CAP-015-R26
	async nameLanguages(acceptLanguage: string | undefined): Promise<NameLanguages> {
		const instance = await this.instanceLanguages()
		return { response: responseLanguage(acceptLanguage, instance), instanceDefault: instance.defaultLanguage }
	}

	// CAP-015-R26
	async defaultLanguage(): Promise<string> {
		return (await this.instanceLanguages()).defaultLanguage
	}

	// CAP-012-R28
	async supportedLanguage(code: string): Promise<string | undefined> {
		return supportedLanguageOf(code, (await this.instanceLanguages()).supportedLanguages)
	}

	administrationTexts(): ResponseTexts {
		return this.textsIn(ADMINISTRATION_LANGUAGE, ADMINISTRATION_LANGUAGE)
	}

	// CAP-015-R26
	private textsIn(language: string, defaultLanguage: string): ResponseTexts {
		const chosen = SERVER_TEXTS[language] ?? SERVER_TEXTS[defaultLanguage] ?? this.releaseTexts()
		return { texts: chosen, contentLanguage: chosen.language }
	}

	private async instanceLanguages(): Promise<InstanceLanguages> {
		const release = this.releaseDefaultLanguage()
		try {
			const values = await this.configuration.values()
			const supportedLanguages = values.get(CONFIGURATION_KEY.SUPPORTED_LANGUAGES)
			return {
				defaultLanguage: textValueOf(values, CONFIGURATION_KEY.DEFAULT_LANGUAGE) ?? release,
				supportedLanguages: Array.isArray(supportedLanguages)
					? supportedLanguages.filter((language) => typeof language === "string")
					: [release],
			}
		} catch (failure) {
			this.logger.warn("The instance languages could not be read", failure)
			return { defaultLanguage: release, supportedLanguages: [release] }
		}
	}

	private releaseTexts(): ServerTexts {
		const texts = SERVER_TEXTS[this.releaseDefaultLanguage()]
		if (texts === undefined) {
			throw new Error("The server release has no texts in the profile default language")
		}
		return texts
	}

	private releaseDefaultLanguage(): string {
		const language = this.profile.configurationSchema.properties?.localization?.properties?.default_language?.default
		if (typeof language !== "string") {
			throw new Error("The profile names no default language")
		}
		return language
	}
}
