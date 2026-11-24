import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common"
import { z } from "zod"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	ACKNOWLEDGEMENT_SUBPATH,
	NOTIFICATION_ID_PARAMETER,
	OPERATOR_NOTIFICATIONS_PATH,
} from "../constants/operator-notification.constants"
import { OperatorNotificationService } from "../services/operator-notification.service"
import type { OperatorNotificationListView } from "../types/operator-notification.types"

const notificationIdSchema = z.uuid()

// CAP-015-R18, CAP-015-R20, CAP-026-R16, CAP-003-R01
@UseGuards(UserSessionGuard)
@Controller(OPERATOR_NOTIFICATIONS_PATH)
export class OperatorNotificationController {
	constructor(private readonly notifications: OperatorNotificationService) {}

	@Get()
	async listOperatorNotifications(
		@CurrentSession() current: CurrentSessionValue,
	): Promise<OperatorNotificationListView> {
		return await this.notifications.list(current.session.userId)
	}

	// CAP-015-S23
	@Post(ACKNOWLEDGEMENT_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	async acknowledgeOperatorNotification(
		@CurrentSession() current: CurrentSessionValue,
		@Param(NOTIFICATION_ID_PARAMETER, new ZodValidationPipe(notificationIdSchema)) notificationId: string,
	): Promise<void> {
		await this.notifications.acknowledge(current.session.userId, notificationId)
	}
}
