import { PERMISSION } from "@ansora/core-server"
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	DELIVERY_ID_PARAMETER,
	DELIVERY_SUBPATH,
	INSTANCE_CLOSURE_SUBPATH,
	INSTANCE_ID_PARAMETER,
	MONITORED_DELIVERIES_PATH,
	TEXT_RECOGNITION_RESTART_SUBPATH,
	VERIFICATION_RESUMPTION_SUBPATH,
} from "../constants/delivery-monitoring.constants"
import { type DeliveryClosureInput, deliveryClosureSchema } from "../dto/delivery-closure.input.dto"
import { type DeliveryPageInput, deliveryPageSchema } from "../dto/delivery-page.input.dto"
import {
	type TextRecognitionRestartInput,
	textRecognitionRestartSchema,
} from "../dto/text-recognition-restart.input.dto"
import { DeliveryClosureService } from "../services/delivery-closure.service"
import { DeliveryOverviewService } from "../services/delivery-overview.service"
import { DeliveryVerificationResumptionService } from "../services/delivery-verification-resumption.service"
import { TextRecognitionRestartService } from "../services/text-recognition-restart.service"
import type { DeliveriesPageView, DeliveryView } from "../types/delivery-monitoring.types"

// CAP-028-R12, CAP-023-R26, CAP-023-R28, CAP-022-R15, administration.yaml listDeliveries, getDelivery,
// resumeDeliveryVerification, closeDeliveryInstance, restartTextRecognition
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(MONITORED_DELIVERIES_PATH)
export class MonitoredDeliveryController {
	constructor(
		private readonly overview: DeliveryOverviewService,
		private readonly verifications: DeliveryVerificationResumptionService,
		private readonly closures: DeliveryClosureService,
		private readonly restarts: TextRecognitionRestartService,
	) {}

	// NAB-345, NAB-534, CAP-028-S06
	@Get()
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async listDeliveries(
		@Query(new ZodValidationPipe(deliveryPageSchema)) query: DeliveryPageInput,
	): Promise<DeliveriesPageView> {
		return await this.overview.list(query)
	}

	// NAB-345, NAB-398
	@Get(DELIVERY_SUBPATH)
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async getDelivery(@Param(DELIVERY_ID_PARAMETER, ParseUUIDPipe) deliveryId: string): Promise<DeliveryView> {
		return await this.overview.detail(deliveryId)
	}

	// CAP-023-S18
	@Post(VERIFICATION_RESUMPTION_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async resumeDeliveryVerification(
		@Param(DELIVERY_ID_PARAMETER, ParseUUIDPipe) deliveryId: string,
		@Param(INSTANCE_ID_PARAMETER, ParseUUIDPipe) instanceId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.verifications.resume(deliveryId, instanceId, administrator)
	}

	// CAP-023-S24, CAP-023-S26
	@Post(INSTANCE_CLOSURE_SUBPATH)
	@HttpCode(HttpStatus.OK)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async closeDeliveryInstance(
		@Param(DELIVERY_ID_PARAMETER, ParseUUIDPipe) deliveryId: string,
		@Param(INSTANCE_ID_PARAMETER, ParseUUIDPipe) instanceId: string,
		@Body(new ZodValidationPipe(deliveryClosureSchema)) closure: DeliveryClosureInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeliveryView> {
		return await this.closures.close(deliveryId, instanceId, closure, administrator)
	}

	// CAP-022-S06
	@Post(TEXT_RECOGNITION_RESTART_SUBPATH)
	@HttpCode(HttpStatus.ACCEPTED)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async restartTextRecognition(
		@Param(DELIVERY_ID_PARAMETER, ParseUUIDPipe) deliveryId: string,
		@Body(new ZodValidationPipe(textRecognitionRestartSchema)) restart: TextRecognitionRestartInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeliveryView> {
		return await this.restarts.restart(deliveryId, restart, administrator)
	}
}
