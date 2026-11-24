import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Injectable } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { LocalizationService } from "../../localization/localization.service"
import { AppUserRepository } from "../repositories/app-user.repository"
import type { LanguagePreference } from "../types/language-preference.types"
import type { AppUser } from "../types/login.types"

// CAP-015-R25
@Injectable()
export class LanguagePreferenceService {
	constructor(
		private readonly users: AppUserRepository,
		private readonly localization: LocalizationService,
	) {}

	// CAP-015-S34
	async preferenceOf(userId: string): Promise<LanguagePreference> {
		return { language: (await this.user(userId)).preferredLanguage }
	}

	async choose(userId: string, code: string): Promise<LanguagePreference> {
		const user = await this.user(userId)
		const language = await this.localization.supportedLanguage(code)
		if (language === undefined) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.LANGUAGE_UNSUPPORTED)
		}
		if (language !== user.preferredLanguage) {
			await this.users.setPreferredLanguage(user.id, language)
		}
		return { language }
	}

	private async user(userId: string): Promise<AppUser> {
		const user = await this.users.findById(userId)
		if (user === undefined) {
			throw new Error(`the session names user ${userId}, who does not exist`)
		}
		return user
	}
}
