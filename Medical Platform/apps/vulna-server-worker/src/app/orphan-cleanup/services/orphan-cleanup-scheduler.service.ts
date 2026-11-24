import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { ORPHAN_CLEANUP_PERIOD_MILLISECONDS } from "../constants/orphan-cleanup.constants"
import { OrphanCleanupService } from "./orphan-cleanup.service"

// CAP-026-R14, dorucovaci-jadro.md 2
@Injectable()
export class OrphanCleanupScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(OrphanCleanupScheduler.name)
	private timer: NodeJS.Timeout | undefined
	private stopped = false

	constructor(private readonly cleanup: OrphanCleanupService) {}

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
			const run = await this.cleanup.run(new Date())
			if (run.setAsideCount > 0) {
				this.logger.log(`Orphan cleanup set aside ${run.setAsideCount} binary objects and alerted the administrator`)
			}
		} catch (error) {
			this.logger.error("The orphan cleanup run failed", error)
		}
		this.schedule(ORPHAN_CLEANUP_PERIOD_MILLISECONDS)
	}
}
