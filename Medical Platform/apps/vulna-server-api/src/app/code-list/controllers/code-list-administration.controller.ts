import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	ADMIN_CODE_LISTS_PATH,
	CODE_LIST_CODE_PARAMETER,
	CODE_LIST_ITEMS_SUBPATH,
	TRANSLATION_IMPORTS_SUBPATH,
} from "../constants/code-list.constants"
import {
	type CodeListItemsInput,
	codeListCodeSchema,
	codeListItemsSchema,
	type TranslationImportInput,
	translationImportSchema,
} from "../dto/code-list-administration.input.dto"
import { CodeListAdministrationService } from "../services/code-list-administration.service"
import type {
	AdministrationCodeList,
	AdministrationCodeListItem,
	TranslationImportResult,
} from "../types/code-list.types"

// CAP-017-R05, CAP-017-R13, CAP-017-R18, administration.yaml listCodeLists
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@RequiresPermission(PERMISSION.CONFIGURATION_MANAGE)
@Controller(`${ADMIN_API_BASE_PATH}/${ADMIN_CODE_LISTS_PATH}`)
export class CodeListAdministrationController {
	constructor(private readonly codeLists: CodeListAdministrationService) {}

	@Get()
	async listCodeLists(): Promise<AdministrationCodeList[]> {
		return await this.codeLists.lists()
	}

	@Get(CODE_LIST_ITEMS_SUBPATH)
	async listCodeListItems(
		@Param(CODE_LIST_CODE_PARAMETER, new ZodValidationPipe(codeListCodeSchema)) codeListCode: string,
	): Promise<AdministrationCodeListItem[]> {
		return await this.codeLists.items(codeListCode)
	}

	@Put(CODE_LIST_ITEMS_SUBPATH)
	async setCodeListItems(
		@Param(CODE_LIST_CODE_PARAMETER, new ZodValidationPipe(codeListCodeSchema)) codeListCode: string,
		@Body(new ZodValidationPipe(codeListItemsSchema)) items: CodeListItemsInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<AdministrationCodeListItem[]> {
		return await this.codeLists.setItems(codeListCode, items, administrator)
	}

	@Post(TRANSLATION_IMPORTS_SUBPATH)
	@HttpCode(HttpStatus.OK)
	async importCodeListTranslations(
		@Body(new ZodValidationPipe(translationImportSchema)) input: TranslationImportInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<TranslationImportResult> {
		return await this.codeLists.importTranslations(input, administrator)
	}
}
