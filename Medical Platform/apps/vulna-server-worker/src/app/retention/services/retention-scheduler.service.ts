import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { RETENTION_PERIOD_MILLISECONDS } from "../constants/retention.constants"
import { BufferCleanupService } from "./buffer-cleanup.service"
import { StoreRetentionService } from "./store-retention.service"

// CAP-026-R11, CAP-026-R18, CAP-026-R19, dorucovaci-jadro.md 6
@Injectable()
export class RetentionScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(RetentionScheduler.name)
	private timer: NodeJS.Timeout | undefined
	private stopped = false

	constructor(
		private readonly bufferCleanup: BufferCleanupService,
		private readonly storeRetention: StoreRetentionService,
	) {}

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
			const now = new Date()
			const deletedCount = await this.bufferCleanup.run(now)
			const { requestedCount, removedCount } = await this.storeRetention.run(now)
			if (deletedCount + requestedCount + removedCount > 0) {
				this.logger.log(
					`Retention deleted ${deletedCount} buffer copies, asked to detach ${requestedCount} files and removed ${removedCount} from the clinical record`,
				)
			}
		} catch (error) {
			this.logger.error("The retention run failed", error)
		}
		this.schedule(RETENTION_PERIOD_MILLISECONDS)
	}
}
