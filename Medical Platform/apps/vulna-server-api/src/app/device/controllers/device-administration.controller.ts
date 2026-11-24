import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
} from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { type DeviceApprovalInput, deviceApprovalSchema } from "../dto/device-approval.input.dto"
import { type DeviceGroupInput, deviceGroupSchema } from "../dto/device-group.input.dto"
import { type DevicePageInput, devicePageSchema } from "../dto/device-page.input.dto"
import { type DeviceUnblockingInput, deviceUnblockingSchema } from "../dto/device-unblocking.input.dto"
import { type GroupAssignmentInput, groupAssignmentSchema } from "../dto/group-assignment.input.dto"
import {
	type GroupLoginMethodsInput,
	groupLoginMethodsSchema,
	type LoginMethodOverridesInput,
	loginMethodOverridesSchema,
} from "../dto/login-methods.input.dto"
import { DeviceAdministrationService } from "../services/device-administration.service"
import type {
	DeviceGroupSaveResult,
	DeviceGroupView,
	DeviceSaveResult,
	DevicesPage,
	DeviceView,
} from "../types/device-administration.types"

@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@RequiresPermission(PERMISSION.DEVICES_MANAGE)
@Controller(ADMIN_API_BASE_PATH)
export class DeviceAdministrationController {
	constructor(private readonly devices: DeviceAdministrationService) {}

	@Get("devices")
	async list(@Query(new ZodValidationPipe(devicePageSchema)) query: DevicePageInput): Promise<DevicesPage> {
		return await this.devices.list(query)
	}

	@Get("devices/:deviceId")
	async detail(@Param("deviceId", ParseUUIDPipe) deviceId: string): Promise<DeviceView> {
		return await this.devices.detail(deviceId)
	}

	@Post("devices/:deviceId/approval")
	@HttpCode(HttpStatus.OK)
	async approve(
		@Param("deviceId", ParseUUIDPipe) deviceId: string,
		@Body(new ZodValidationPipe(deviceApprovalSchema)) approval: DeviceApprovalInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceView> {
		return await this.devices.approve(deviceId, approval, administrator)
	}

	@Post("devices/:deviceId/revocation")
	@HttpCode(HttpStatus.OK)
	async revoke(
		@Param("deviceId", ParseUUIDPipe) deviceId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceView> {
		return await this.devices.revoke(deviceId, administrator)
	}

	// CAP-007-R06, CAP-007-S07, CAP-008-R07
	@Post("devices/:deviceId/unblocking")
	@HttpCode(HttpStatus.OK)
	async unblock(
		@Param("deviceId", ParseUUIDPipe) deviceId: string,
		@Body(new ZodValidationPipe(deviceUnblockingSchema)) unblocking: DeviceUnblockingInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceView> {
		return await this.devices.unblock(deviceId, unblocking, administrator)
	}

	@Put("devices/:deviceId/group")
	async assignGroup(
		@Param("deviceId", ParseUUIDPipe) deviceId: string,
		@Body(new ZodValidationPipe(groupAssignmentSchema)) assignment: GroupAssignmentInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceView> {
		return await this.devices.assignGroup(deviceId, assignment.group_code, administrator)
	}

	@Put("devices/:deviceId/login-methods")
	async setDeviceLoginMethods(
		@Param("deviceId", ParseUUIDPipe) deviceId: string,
		@Body(new ZodValidationPipe(loginMethodOverridesSchema)) overrides: LoginMethodOverridesInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceSaveResult> {
		return await this.devices.setDeviceLoginMethods(deviceId, overrides, administrator)
	}

	@Get("device-groups")
	async groups(): Promise<DeviceGroupView[]> {
		return await this.devices.groups()
	}

	@Post("device-groups")
	@HttpCode(HttpStatus.CREATED)
	async createGroup(
		@Body(new ZodValidationPipe(deviceGroupSchema)) group: DeviceGroupInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceGroupSaveResult> {
		return await this.devices.createGroup(group, administrator)
	}

	@Get("device-groups/:groupId")
	async group(@Param("groupId", ParseUUIDPipe) groupId: string): Promise<DeviceGroupView> {
		return await this.devices.group(groupId)
	}

	@Patch("device-groups/:groupId")
	async updateGroup(
		@Param("groupId", ParseUUIDPipe) groupId: string,
		@Body(new ZodValidationPipe(deviceGroupSchema)) group: DeviceGroupInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceGroupSaveResult> {
		return await this.devices.updateGroup(groupId, group, administrator)
	}

	@Post("device-groups/:groupId/login-methods")
	@HttpCode(HttpStatus.OK)
	async applyGroupLoginMethods(
		@Param("groupId", ParseUUIDPipe) groupId: string,
		@Body(new ZodValidationPipe(groupLoginMethodsSchema)) application: GroupLoginMethodsInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DeviceGroupSaveResult> {
		return await this.devices.applyGroupLoginMethods(groupId, application, administrator)
	}
}
