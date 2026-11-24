import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import type { CurrentSession } from "../../login/types/login.types"
import type { RecordRelease } from "../types/image.types"
import { recordReleaseEventOf } from "../utils/record-release-event"

// CAP-025-R28, CAP-020-R05
@Injectable()
export class RecordReleaseService {
	constructor(
		private readonly database: DatabaseService,
		private readonly audit: AuditRepository,
	) {}

	async record(current: CurrentSession, release: RecordRelease): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, userAuditEventOf(current, recordReleaseEventOf(release)))
		})
	}
}
