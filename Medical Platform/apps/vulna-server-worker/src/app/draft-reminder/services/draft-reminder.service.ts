import { CONFIGURATION_KEY, requiredIntegerOf } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { DraftReminderRepository } from "../repositories/draft-reminder.repository"
import { StaleDraftsAlertRepository } from "../repositories/stale-drafts-alert.repository"
import type { DraftReminderRun } from "../types/draft-reminder.types"
import { staleDraftsAlertEventOf } from "../utils/alert-audit-event"
import { staleDraftsMessageOf } from "../utils/stale-drafts-message"

// CAP-015-R18, CAP-026-R16, CAP-004-R14, CAP-028-R15
@Injectable()
export class DraftReminderService {
	constructor(
		private readonly database: DatabaseService,
		private readonly configuration: ConfigurationService,
		private readonly reminders: DraftReminderRepository,
		private readonly alerts: StaleDraftsAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async run(now: Date): Promise<DraftReminderRun> {
		const values = await this.configuration.effectiveValues()
		const reminderSeconds = requiredIntegerOf(values, CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS)
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const remindedCount = await this.reminders.remindStaleDrafts(tx, reminderSeconds)
			const staleCount = await this.reminders.countStaleDrafts(tx, reminderSeconds)
			if (staleCount === 0) {
				await this.alerts.resolve(tx)
				return { remindedCount, staleCount }
			}
			await this.alertAbout(tx, staleCount, reminderSeconds, now)
			return { remindedCount, staleCount }
		})
	}

	// CAP-028-R15
	private async alertAbout(
		tx: postgres.TransactionSql,
		staleCount: number,
		reminderSeconds: number,
		now: Date,
	): Promise<void> {
		const message = staleDraftsMessageOf(staleCount, reminderSeconds)
		const alertId = await this.alerts.raise(tx, message)
		if (alertId === undefined) {
			await this.alerts.refresh(tx, message)
			return
		}
		await this.audit.appendSystemJob(tx, staleDraftsAlertEventOf(alertId, message, staleCount), now)
	}
}
