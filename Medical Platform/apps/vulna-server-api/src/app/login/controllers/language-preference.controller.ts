import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../decorators/current-session.decorator"
import { languagePreferenceSchema } from "../dto/language-preference.input.dto"
import { UserSessionGuard } from "../guards/user-session.guard"
import { LanguagePreferenceService } from "../services/language-preference.service"
import type { LanguagePreference, LanguagePreferenceInput } from "../types/language-preference.types"
import type { CurrentSession as CurrentSessionValue } from "../types/login.types"

// CAP-002-R09
@UseGuards(UserSessionGuard)
@Controller("user/language-preference")
export class LanguagePreferenceController {
	constructor(private readonly preferences: LanguagePreferenceService) {}

	@Get()
	async getLanguagePreference(@CurrentSession() current: CurrentSessionValue): Promise<LanguagePreference> {
		return await this.preferences.preferenceOf(current.session.userId)
	}

	@Put()
	async setLanguagePreference(
		@CurrentSession() current: CurrentSessionValue,
		@Body(new ZodValidationPipe(languagePreferenceSchema)) input: LanguagePreferenceInput,
	): Promise<LanguagePreference> {
		return await this.preferences.choose(current.session.userId, input.language)
	}
}
