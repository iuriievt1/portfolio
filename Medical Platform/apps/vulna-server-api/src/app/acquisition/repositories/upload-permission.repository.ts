import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { UploadPermission, UploadPermissionRow } from "../types/queue-sender.types"

// ADR-014
@Injectable()
export class UploadPermissionRepository {
	constructor(private readonly database: DatabaseService) {}

	// ADR-014
	async replace(
		tx: postgres.TransactionSql,
		tokenHash: string,
		permission: UploadPermission,
		expiresAt: Date,
	): Promise<void> {
		await tx`
			INSERT INTO upload_permission
				(token_hash, acquisition_id, file_key, device_id, sender_session_id, sha256, expires_at)
			VALUES (
				${tokenHash}, ${permission.acquisitionId}, ${permission.fileKey}, ${permission.deviceId},
				${permission.senderSession?.sessionId ?? null}, ${permission.sha256}, ${expiresAt}
			)
			ON CONFLICT (acquisition_id, file_key) DO UPDATE SET
				token_hash = EXCLUDED.token_hash,
				device_id = EXCLUDED.device_id,
				sender_session_id = EXCLUDED.sender_session_id,
				sha256 = EXCLUDED.sha256,
				expires_at = EXCLUDED.expires_at
		`
	}

	// CAP-025-R17
	async findValid(tokenHash: string, now: Date): Promise<UploadPermissionRow | undefined> {
		const [row] = await this.database.sql<UploadPermissionRow[]>`
			SELECT
				permission.acquisition_id, permission.file_key, permission.device_id, permission.sender_session_id,
				sender.user_id AS sender_user_id, permission.sha256
			FROM upload_permission permission
			LEFT JOIN session sender ON sender.id = permission.sender_session_id
			WHERE permission.token_hash = ${tokenHash} AND permission.expires_at > ${now}
		`
		return row
	}
}
