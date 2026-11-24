import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { Request } from "express"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { signedBodySchema } from "../dto/signed-body.input.dto"
import { CardBindingService } from "../services/card-binding.service"
import type { CardBindingReceipt } from "../types/login.types"

@Controller("card-bindings")
export class CardBindingController {
	constructor(private readonly bindings: CardBindingService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	async completeCardBinding(
		@Req() request: Request,
		@Body(new ZodValidationPipe(signedBodySchema)) body: string,
	): Promise<CardBindingReceipt> {
		return await this.bindings.complete(request, body)
	}
}
