import { Module } from "@nestjs/common"
import { DraftReminderRepository } from "./repositories/draft-reminder.repository"
import { StaleDraftsAlertRepository } from "./repositories/stale-drafts-alert.repository"
import { DraftReminderService } from "./services/draft-reminder.service"
import { DraftReminderScheduler } from "./services/draft-reminder-scheduler.service"

// CAP-026-R16, CAP-015-R18
@Module({
	providers: [DraftReminderRepository, StaleDraftsAlertRepository, DraftReminderService, DraftReminderScheduler],
})
export class DraftReminderModule {}
