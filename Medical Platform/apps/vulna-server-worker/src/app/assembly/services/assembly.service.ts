import { CONFIGURATION_KEY, requiredIntegerOf } from "@ansora/core-server"
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { QueueLanePool } from "../../../libs/queue/queue-lane-pool"
import { ASSEMBLY_TASK_POLL_MILLISECONDS } from "../constants/assembly.constants"
import { AssemblyResultRepository } from "../repositories/assembly-result.repository"
import { AssemblerService } from "./assembler.service"
import { AssemblyLane } from "./assembly-lane"
import { AssemblySettingsService } from "./assembly-settings.service"

// ADR-016 ř. 56–59, ADR-005 ř. 38, CAP-021-R04, CAP-022-R08
@Injectable()
export class AssemblyService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(AssemblyService.name)
	private readonly pool = new QueueLanePool(
		this.logger,
		async () => await this.lanes(),
		"Reading how many records to assemble at once failed",
		ASSEMBLY_TASK_POLL_MILLISECONDS,
	)

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly results: AssemblyResultRepository,
		private readonly settings: AssemblySettingsService,
		private readonly assembler: AssemblerService,
	) {}

	onApplicationBootstrap(): void {
		this.pool.start()
	}

	onApplicationShutdown(): void {
		this.pool.stop()
	}

	private async lanes(): Promise<AssemblyLane[]> {
		const values = await this.configuration.effectiveValues()
		const laneCount = requiredIntegerOf(values, CONFIGURATION_KEY.QUEUE_ASSEMBLY_CONCURRENCY)
		this.logger.log(`Assembly runs ${laneCount} records at once`)
		return Array.from({ length: laneCount }, () => new AssemblyLane(this.results.queue, this.settings, this.assembler))
	}
}
