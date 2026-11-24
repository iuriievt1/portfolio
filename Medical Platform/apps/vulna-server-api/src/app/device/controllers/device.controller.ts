import type { DeviceEventBatch, DeviceEventBatchReceipt, IntegrityReport } from "@ansora/contracts"
import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { Request } from "express"
import { AcceptsAnyAppVersion } from "../../infra/decorators/accepts-any-app-version.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { deviceEventBatchSchema } from "../dto/device-event-batch.input.dto"
import { type DeviceRegistrationDto, deviceRegistrationSchema } from "../dto/device-registration.input.dto"
import { integrityReportSchema } from "../dto/integrity-report.input.dto"
import { DeviceService } from "../services/device.service"
import { DeviceEventService } from "../services/device-event.service"
import { DeviceIntegrityService } from "../services/device-integrity.service"
import type { DeviceStateResponse } from "../types/device.types"

@Controller("device")
export class DeviceController {
	constructor(
		private readonly devices: DeviceService,
		private readonly events: DeviceEventService,
		private readonly integrity: DeviceIntegrityService,
	) {}

	@Post("registration")
	@HttpCode(HttpStatus.CREATED)
	async register(
		@Req() request: Request,
		@Body(new ZodValidationPipe(deviceRegistrationSchema)) registration: DeviceRegistrationDto,
	): Promise<DeviceStateResponse> {
		return await this.devices.register(request, registration)
	}

	@Post("verification")
	@HttpCode(HttpStatus.OK)
	async verify(@Req() request: Request): Promise<DeviceStateResponse> {
		return await this.devices.verify(request)
	}

	// CAP-008-R04, CAP-008-R05, CAP-012-R24
	@Post("integrity")
	@HttpCode(HttpStatus.ACCEPTED)
	@AcceptsAnyAppVersion()
	async reportDeviceIntegrity(
		@Req() request: Request,
		@Body(new ZodValidationPipe(integrityReportSchema)) report: IntegrityReport,
	): Promise<void> {
		await this.integrity.report(request, report)
	}

	// CAP-012-R24
	@Post("events")
	@HttpCode(HttpStatus.OK)
	@AcceptsAnyAppVersion()
	async reportDeviceEvents(
		@Req() request: Request,
		@Body(new ZodValidationPipe(deviceEventBatchSchema)) batch: DeviceEventBatch,
	): Promise<DeviceEventBatchReceipt> {
		return await this.events.record(request, batch)
	}
}
