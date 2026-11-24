import { ERROR_CODE, OPERATOR_ID_HEADER } from "@ansora/contracts"
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { z } from "zod"
import { DeviceTokenService } from "../../device/services/device-token.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import { SessionService } from "../../login/services/session.service"
import type { UserSession, UserSessionRequest } from "../../login/types/login.types"
import { bearerToken } from "../../login/utils/bearer-token"
import { signInAgain } from "../../login/utils/login-rejection"
import { DeviceRequestLimitService } from "../../request-rate/services/device-request-limit.service"
import { ACCEPTS_UPLOAD_PERMISSION, QUEUE_SENDER } from "../constants/queue-sender.constants"
import { UploadPermissionService } from "../services/upload-permission.service"
import type { QueueSender, QueueSenderRequest } from "../types/queue-sender.types"

type SenderRequest = QueueSenderRequest & UserSessionRequest

const operatorIdSchema = z.uuid()

// CAP-002-R09, CAP-021-R13, ADR-013, ADR-014
@Injectable()
export class QueueSenderGuard implements CanActivate {
	constructor(
		private readonly sessions: SessionService,
		private readonly userSessions: UserSessionGuard,
		private readonly clinicians: ClinicianRoleGuard,
		private readonly deviceTokens: DeviceTokenService,
		private readonly permissions: UploadPermissionService,
		private readonly limits: DeviceRequestLimitService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<SenderRequest>()
		const token = bearerToken(request.headers.authorization)
		if (token === undefined) {
			throw signInAgain()
		}
		request.queueSender = await this.senderOf(context, request, token)
		return true
	}

	private async senderOf(context: ExecutionContext, request: SenderRequest, token: string): Promise<QueueSender> {
		const session = await this.sessions.resolve(token)
		if (session !== undefined) {
			return await this.userSender(context, token, session)
		}
		const now = new Date()
		const permission = this.acceptsUploadPermission(context) ? await this.permissions.find(token, now) : undefined
		if (permission !== undefined) {
			const device = await this.deviceTokens.approvedDeviceOf(permission.deviceId)
			// api/README.md 7
			await this.limits.count(device.hwId, now)
			return { kind: QUEUE_SENDER.UPLOAD_PERMISSION, device, permission }
		}
		return await this.deviceSender(request, token, now)
	}

	private async userSender(context: ExecutionContext, token: string, session: UserSession): Promise<QueueSender> {
		const current = await this.userSessions.admit(context, token, session)
		await this.clinicians.canActivate(context)
		return { kind: QUEUE_SENDER.USER, current }
	}

	// CAP-002-S31, CAP-002-S33
	private async deviceSender(request: SenderRequest, token: string, now: Date): Promise<QueueSender> {
		const device = await this.deviceTokens.provenDeviceOf(request, token, now)
		const operator = operatorIdSchema.safeParse(request.header(OPERATOR_ID_HEADER))
		if (!operator.success) {
			throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.RECORD_REJECTED)
		}
		return { kind: QUEUE_SENDER.DEVICE, device, operatorUserId: operator.data }
	}

	private acceptsUploadPermission(context: ExecutionContext): boolean {
		return this.reflector.get<boolean | undefined>(ACCEPTS_UPLOAD_PERMISSION, context.getHandler()) === true
	}
}
