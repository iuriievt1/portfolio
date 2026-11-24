import { CONFIGURATION_KEY, randomSecret, secondsAfter, sha256Hex } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { UploadPermissionRepository } from "../repositories/upload-permission.repository"
import type {
	IssuedUploadPermission,
	SenderSession,
	UploadPermission,
	UploadPermissionRow,
} from "../types/queue-sender.types"

// CAP-025-R17
function senderSessionOf(row: UploadPermissionRow): SenderSession | undefined {
	if (row.sender_session_id === null || row.sender_user_id === null) {
		return undefined
	}
	return { sessionId: row.sender_session_id, userId: row.sender_user_id }
}

// ADR-014, CAP-021-R29
@Injectable()
export class UploadPermissionService {
	constructor(
		private readonly permissions: UploadPermissionRepository,
		private readonly configuration: ConfigurationService,
	) {}

	async issue(tx: postgres.TransactionSql, permission: UploadPermission, now: Date): Promise<IssuedUploadPermission> {
		const token = randomSecret()
		const lifetimeSeconds = await this.configuration.integer(
			CONFIGURATION_KEY.ACQUISITION_UPLOAD_PERMISSION_LIFETIME_SECONDS,
		)
		const expiresAt = secondsAfter(now, lifetimeSeconds)
		await this.permissions.replace(tx, sha256Hex(token), permission, expiresAt)
		return { token, expiresAt }
	}

	async find(token: string, now: Date): Promise<UploadPermission | undefined> {
		const row = await this.permissions.findValid(sha256Hex(token), now)
		if (row === undefined) {
			return undefined
		}
		return {
			acquisitionId: row.acquisition_id,
			fileKey: row.file_key,
			deviceId: row.device_id,
			senderSession: senderSessionOf(row),
			sha256: row.sha256,
		}
	}
}
