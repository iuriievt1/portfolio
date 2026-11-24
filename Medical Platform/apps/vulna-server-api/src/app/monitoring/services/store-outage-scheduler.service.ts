import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { STORE_OUTAGE_CHECK_MILLISECONDS } from "../constants/monitoring.constants"
import { StoreOutageAlertService } from "./store-outage-alert.service"

// CAP-028-R15, CAP-028-R22
@Injectable()
export class StoreOutageScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(StoreOutageScheduler.name)
	private timer: NodeJS.Timeout | undefined
	private isStopped = false

	constructor(private readonly outages: StoreOutageAlertService) {}

	onApplicationBootstrap(): void {
		this.schedule()
	}

	onApplicationShutdown(): void {
		this.isStopped = true
		clearTimeout(this.timer)
	}

	private schedule(): void {
		if (this.isStopped) {
			return
		}
		this.timer = setTimeout(() => void this.tick(), STORE_OUTAGE_CHECK_MILLISECONDS)
	}

	private async tick(): Promise<void> {
		try {
			await this.outages.evaluate()
		} catch (error) {
			this.logger.error("The clinical record store outage check failed", error)
		}
		this.schedule()
	}
}
