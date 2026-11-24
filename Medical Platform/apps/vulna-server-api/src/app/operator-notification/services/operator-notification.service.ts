import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Injectable } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { OperatorNotificationRepository } from "../repositories/operator-notification.repository"
import type { OperatorNotificationListView } from "../types/operator-notification.types"
import { operatorNotificationViewOf } from "../utils/operator-notification-view"

// CAP-015-R18, CAP-015-R20, CAP-026-R16
@Injectable()
export class OperatorNotificationService {
	constructor(private readonly notifications: OperatorNotificationRepository) {}

	async list(userId: string): Promise<OperatorNotificationListView> {
		const rows = await this.notifications.listUnacknowledged(userId)
		return { items: rows.map(operatorNotificationViewOf) }
	}

	async acknowledge(userId: string, notificationId: string): Promise<void> {
		const isFound = await this.notifications.acknowledge(userId, notificationId)
		if (!isFound) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
	}
}
