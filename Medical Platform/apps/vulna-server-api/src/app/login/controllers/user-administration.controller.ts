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
import { userDepartmentSchema } from "../dto/user-department.input.dto"
import { type UserPageInput, userPageSchema } from "../dto/user-page.input.dto"
import { type UserRolesInput, userRolesSchema } from "../dto/user-roles.input.dto"
import { CarrierRevocationService } from "../services/carrier-revocation.service"
import { UserAdministrationService } from "../services/user-administration.service"
import { UserRevocationService } from "../services/user-revocation.service"
import type { UserDepartmentInput } from "../types/department.types"
import type { CardView, QrCodeView, RoleView, UsersPage, UserView } from "../types/user-administration.types"

@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@RequiresPermission(PERMISSION.USERS_MANAGE)
@Controller(ADMIN_API_BASE_PATH)
export class UserAdministrationController {
	constructor(
		private readonly users: UserAdministrationService,
		private readonly revocations: UserRevocationService,
		private readonly carriers: CarrierRevocationService,
	) {}

	@Get("users")
	async listUsers(@Query(new ZodValidationPipe(userPageSchema)) query: UserPageInput): Promise<UsersPage> {
		return await this.users.list(query)
	}

	@Get("users/:userId")
	async getUser(@Param("userId", ParseUUIDPipe) userId: string): Promise<UserView> {
		return await this.users.detail(userId)
	}

	@Put("users/:userId/roles")
	async setUserRoles(
		@Param("userId", ParseUUIDPipe) userId: string,
		@Body(new ZodValidationPipe(userRolesSchema)) input: UserRolesInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<UserView> {
		return await this.users.setManualRoles(userId, input.roles, administrator)
	}

	@Put("users/:userId/department")
	async setUserDepartment(
		@Param("userId", ParseUUIDPipe) userId: string,
		@Body(new ZodValidationPipe(userDepartmentSchema)) input: UserDepartmentInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<UserView> {
		return await this.users.setDepartment(userId, input.department, administrator)
	}

	@Post("users/:userId/revocation")
	@HttpCode(HttpStatus.NO_CONTENT)
	async revokeUser(
		@Param("userId", ParseUUIDPipe) userId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.revocations.revoke(userId, administrator)
	}

	@Get("roles")
	async listRoles(): Promise<RoleView[]> {
		return await this.users.listRoles()
	}

	@Get("users/:userId/cards")
	@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
	async listUserCards(@Param("userId", ParseUUIDPipe) userId: string): Promise<CardView[]> {
		return await this.users.cardsOf(userId)
	}

	@Post("users/:userId/qr-codes")
	@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
	@HttpCode(HttpStatus.CREATED)
	async issueQrCode(
		@Param("userId", ParseUUIDPipe) userId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<QrCodeView> {
		return await this.users.issueQrCode(userId, administrator)
	}

	@Get("users/:userId/qr-codes")
	@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
	async listUserQrCodes(@Param("userId", ParseUUIDPipe) userId: string): Promise<QrCodeView[]> {
		return await this.users.qrCodesOf(userId)
	}

	@Post("qr-codes/:qrCodeId/revocation")
	@RequiresPermission(PERMISSION.CREDENTIALS_MANAGE)
	@HttpCode(HttpStatus.NO_CONTENT)
	async revokeQrCode(
		@Param("qrCodeId", ParseUUIDPipe) qrCodeId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.carriers.revokeQrCode(qrCodeId, administrator)
	}
}
