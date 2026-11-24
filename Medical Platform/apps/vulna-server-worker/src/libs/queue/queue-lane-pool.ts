import type { Logger } from "@nestjs/common"

const AT_ONCE_MILLISECONDS = 0

export interface PolledLane {
	startPolling(): void
	stopPolling(): void
}

// ADR-016 ř. 56–59, ADR-005 ř. 38
export class QueueLanePool<Lane extends PolledLane> {
	private lanes: Lane[] = []
	private timer: NodeJS.Timeout | undefined
	private isStopped = false

	constructor(
		private readonly logger: Logger,
		private readonly lanesOf: () => Promise<Lane[]>,
		private readonly failure: string,
		private readonly retryMilliseconds: number,
	) {}

	start(): void {
		this.schedule(AT_ONCE_MILLISECONDS)
	}

	stop(): void {
		this.isStopped = true
		clearTimeout(this.timer)
		for (const lane of this.lanes) {
			lane.stopPolling()
		}
	}

	private schedule(delayMilliseconds: number): void {
		if (this.isStopped) {
			return
		}
		this.timer = setTimeout(() => void this.started(), delayMilliseconds)
	}

	private async started(): Promise<void> {
		let lanes: Lane[]
		try {
			lanes = await this.lanesOf()
		} catch (error) {
			this.logger.error(this.failure, error)
			this.schedule(this.retryMilliseconds)
			return
		}
		if (this.isStopped) {
			return
		}
		this.lanes = lanes
		for (const lane of lanes) {
			lane.startPolling()
		}
	}
}
