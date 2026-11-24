import {
	type HeldQueueLease,
	JOB_KIND,
	JOB_OBJECT_KIND,
	type QueueClaimRule,
	type QueueLoopTiming,
	QueueTaskLoop,
} from "@ansora/core-server"
import { Logger } from "@nestjs/common"
import type { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import type { ClaimedDeliveryTask, DeliveryObjectKind, DeliverySettings } from "../types/delivery.types"
import { minimumBackoffMillisecondsOf } from "../utils/delivery-timing"
import type { DeliveryRecorderService } from "./delivery-recorder.service"
import type { DeliverySettingsService } from "./delivery-settings.service"
import type { InstanceDeliveryService } from "./instance-delivery.service"

// ADR-016 ř. 54, 56–59, ADR-005 ř. 21, 36, dorucovaci-jadro.md 4
export class DeliveryLane extends QueueTaskLoop<DeliveryObjectKind, DeliverySettings> {
	protected readonly logger = new Logger(DeliveryLane.name)

	constructor(
		timing: QueueLoopTiming,
		private readonly instances: DeliveryInstanceRepository,
		private readonly settings: DeliverySettingsService,
		private readonly delivery: InstanceDeliveryService,
		private readonly recorder: DeliveryRecorderService,
	) {
		super(instances.queue, timing)
	}

	// datovy-model.md 4 „Úloha fronty“ attempts, dorucovaci-jadro.md 5.3
	protected claimRule(): QueueClaimRule<DeliveryObjectKind> {
		return {
			kind: JOB_KIND.DELIVERY,
			objectKinds: [JOB_OBJECT_KIND.DELIVERY_INSTANCE],
			condition: this.instances.claimCondition(),
			countsAttempts: false,
		}
	}

	protected async prepare(): Promise<DeliverySettings | undefined> {
		return await this.settings.current()
	}

	protected async handle(task: ClaimedDeliveryTask, settings: DeliverySettings, lease: HeldQueueLease): Promise<void> {
		try {
			await this.delivery.deliver(task, settings, lease)
		} catch (error) {
			const delayMilliseconds = minimumBackoffMillisecondsOf(settings)
			await this.recorder.postpone(task, lease, delayMilliseconds)
			this.logger.error(`Delivering instance ${task.objectId} (task ${task.id}) waits ${delayMilliseconds} ms`, error)
		}
	}
}
