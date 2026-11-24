import { CONFIGURATION_KEY, requiredIntegerOf } from "@ansora/core-server"
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { QueueLanePool } from "../../../libs/queue/queue-lane-pool"
import { DELIVERY_TASK_POLL_MILLISECONDS } from "../constants/delivery.constants"
import { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import { deliveryLeaseMillisecondsOf, minimumBackoffMillisecondsOf } from "../utils/delivery-timing"
import { DeliveryLane } from "./delivery-lane"
import { DeliveryRecorderService } from "./delivery-recorder.service"
import { DeliverySettingsService } from "./delivery-settings.service"
import { InstanceDeliveryService } from "./instance-delivery.service"
import { TargetWatchService } from "./target-watch.service"

// ADR-016 ř. 56–59, ADR-005 ř. 21, 38, CAP-023-R07, CAP-023-R24
@Injectable()
export class DeliveryService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(DeliveryService.name)
	private readonly pool = new QueueLanePool(
		this.logger,
		async () => await this.lanes(),
		"Reading how many instances to deliver at once failed",
		DELIVERY_TASK_POLL_MILLISECONDS,
	)
	private watchTimer: NodeJS.Timeout | undefined
	private isStopped = false

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly instances: DeliveryInstanceRepository,
		private readonly settings: DeliverySettingsService,
		private readonly delivery: InstanceDeliveryService,
		private readonly recorder: DeliveryRecorderService,
		private readonly watcher: TargetWatchService,
	) {}

	onApplicationBootstrap(): void {
		this.pool.start()
		this.scheduleWatch(DELIVERY_TASK_POLL_MILLISECONDS)
	}

	onApplicationShutdown(): void {
		this.isStopped = true
		clearTimeout(this.watchTimer)
		this.pool.stop()
	}

	private async lanes(): Promise<DeliveryLane[]> {
		const values = await this.configuration.effectiveValues()
		const laneCount = requiredIntegerOf(values, CONFIGURATION_KEY.QUEUE_DELIVERY_CONCURRENCY)
		const leaseMilliseconds = deliveryLeaseMillisecondsOf(values)
		const timing = { leaseMilliseconds, pollMilliseconds: DELIVERY_TASK_POLL_MILLISECONDS }
		this.logger.log(`Delivery runs ${laneCount} instances at once under a lease of ${leaseMilliseconds} ms`)
		return Array.from(
			{ length: laneCount },
			() => new DeliveryLane(timing, this.instances, this.settings, this.delivery, this.recorder),
		)
	}

	private scheduleWatch(delayMilliseconds: number): void {
		if (this.isStopped) {
			return
		}
		this.watchTimer = setTimeout(() => void this.watch(), delayMilliseconds)
	}

	// CAP-023-R24
	private async watch(): Promise<void> {
		let delayMilliseconds = DELIVERY_TASK_POLL_MILLISECONDS
		try {
			const settings = await this.settings.current()
			if (settings !== undefined) {
				delayMilliseconds = minimumBackoffMillisecondsOf(settings)
				await this.watcher.watch(settings)
			}
		} catch (error) {
			this.logger.error("Watching unavailable delivery targets failed", error)
		}
		this.scheduleWatch(delayMilliseconds)
	}
}
