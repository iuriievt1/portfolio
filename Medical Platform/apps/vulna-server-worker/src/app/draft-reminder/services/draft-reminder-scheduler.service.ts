import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { DRAFT_REMINDER_PERIOD_MILLISECONDS } from "../constants/draft-reminder.constants"
import { DraftReminderService } from "./draft-reminder.service"

// CAP-026-R16, CAP-015-R18
@Injectable()
export class DraftReminderScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(DraftReminderScheduler.name)
	private timer: NodeJS.Timeout | undefined
	private stopped = false

	constructor(private readonly reminders: DraftReminderService) {}

	onApplicationBootstrap(): void {
		this.schedule(0)
	}

	onApplicationShutdown(): void {
		this.stopped = true
		clearTimeout(this.timer)
	}

	private schedule(delay: number): void {
		if (this.stopped) {
			return
		}
		this.timer = setTimeout(() => void this.tick(), delay)
	}

	private async tick(): Promise<void> {
		try {
			const run = await this.reminders.run(new Date())
			if (run.remindedCount > 0) {
				this.logger.log(`Reminded ${run.remindedCount} stale drafts; ${run.staleCount} drafts are stale`)
			}
		} catch (error) {
			this.logger.error("The draft reminder run failed", error)
		}
		this.schedule(DRAFT_REMINDER_PERIOD_MILLISECONDS)
	}
}
