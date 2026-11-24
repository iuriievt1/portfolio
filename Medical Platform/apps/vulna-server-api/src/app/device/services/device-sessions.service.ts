import { SESSION_END_REASON } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { sessionTerminationEventOf } from "../../audit/utils/session-termination-event"
import { DeviceAdministrationRepository } from "../repositories/device-administration.repository"

@Injectable()
export class DeviceSessionsService {
	constructor(
		private readonly devices: DeviceAdministrationRepository,
		private readonly audit: AuditRepository,
	) {}

	// CAP-002-R08, CAP-002-R10, CAP-002-R11
	async endAll(tx: postgres.TransactionSql, deviceId: string): Promise<void> {
		for (const ended of await this.devices.endSessionsOf(tx, deviceId, new Date())) {
			if (ended.user_id !== null) {
				const session = { id: ended.id, userId: ended.user_id, deviceId }
				await this.audit.append(tx, sessionTerminationEventOf(session, SESSION_END_REASON.DEVICE_REVOKED))
			}
		}
	}
}
