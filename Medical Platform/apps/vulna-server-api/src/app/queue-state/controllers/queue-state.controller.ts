import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { QUEUE_PATH, REPORTS_SUBPATH, STATE_SUBPATH } from "../constants/queue-state.constants"
import { QueueCaller } from "../decorators/queue-caller.decorator"
import { type QueueReportInput, queueReportSchema } from "../dto/queue-report.input.dto"
import { type QueueStateQueryInput, queueStateQuerySchema } from "../dto/queue-state.input.dto"
import { QueueCallerGuard } from "../guards/queue-caller.guard"
import { QueueStateService } from "../services/queue-state.service"
import type { QueueCaller as QueueCallerValue, QueueStatesPageView } from "../types/queue-state.types"

// CAP-019-R08, CAP-019-R30, CAP-002-R09, NAB-297
@UseGuards(QueueCallerGuard)
@Controller(QUEUE_PATH)
export class QueueStateController {
	constructor(private readonly queue: QueueStateService) {}

	@Get(STATE_SUBPATH)
	async getQueueState(
		@QueueCaller() caller: QueueCallerValue,
		@Query(new ZodValidationPipe(queueStateQuerySchema)) query: QueueStateQueryInput,
	): Promise<QueueStatesPageView> {
		return await this.queue.list(caller, query)
	}

	@Post(REPORTS_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	async reportQueueState(
		@QueueCaller() caller: QueueCallerValue,
		@Body(new ZodValidationPipe(queueReportSchema)) input: QueueReportInput,
	): Promise<void> {
		await this.queue.report(caller, input, new Date())
	}
}
