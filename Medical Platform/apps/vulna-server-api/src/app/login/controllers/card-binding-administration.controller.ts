import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { type CardBindingCodeInput, cardBindingCodeSchema } from "../dto/card-binding-code.input.dto"
import { CardBindingService } from "../services/card-binding.service"
import { CarrierRevocationService } from "../services/carrier-revocation.service"
import type { CardBindingCode } from "../types/login.types"

@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
@Controller(ADMIN_API_BASE_PATH)
export class CardBindingAdministrationController {
	constructor(
		private readonly bindings: CardBindingService,
		private readonly carriers: CarrierRevocationService,
	) {}

	@Post("users/:userId/cards")
	@HttpCode(HttpStatus.CREATED)
	async createCardBinding(
		@Param("userId", ParseUUIDPipe) userId: string,
		@Administrator() administrator: AdministrationSession,
		@Body(new ZodValidationPipe(cardBindingCodeSchema)) input: CardBindingCodeInput | undefined,
	): Promise<CardBindingCode> {
		return await this.bindings.issueCode(userId, administrator, input?.note)
	}

	@Post("cards/:cardId/revocation")
	@HttpCode(HttpStatus.NO_CONTENT)
	async revokeCard(
		@Param("cardId", ParseUUIDPipe) cardId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.carriers.revokeCard(cardId, administrator)
	}
}
