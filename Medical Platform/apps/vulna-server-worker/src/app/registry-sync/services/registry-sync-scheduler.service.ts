import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import { SETTINGS_POLL_MILLISECONDS } from "../constants/registry-sync.constants"
import { SyncRunRepository } from "../repositories/sync-run.repository"
import { RegistrySourceService } from "./registry-source.service"
import { RegistrySyncService } from "./registry-sync.service"
import { RegistrySyncSettingsService } from "./registry-sync-settings.service"

// CAP-024-R04, CAP-024-R09
@Injectable()
export class RegistrySyncScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(RegistrySyncScheduler.name)
	private timer: NodeJS.Timeout | undefined
	private stopped = false
	private warnedAboutSource = false

	constructor(
		private readonly settings: RegistrySyncSettingsService,
		private readonly runs: SyncRunRepository,
		private readonly sources: RegistrySourceService,
		private readonly sync: RegistrySyncService,
	) {}

	onApplicationBootstrap(): void {
		this.schedule(0)
	}

	onApplicationShutdown(): void {
		this.stopped = true
		clearTimeout(this.timer)
	}

	async runWhenDue(now: Date): Promise<number> {
		const settings = await this.settings.current()
		if (settings.periodSeconds === undefined) {
			return SETTINGS_POLL_MILLISECONDS
		}
		const source = await this.sources.current()
		if (source === undefined) {
			this.warnOnceAboutSource()
			return SETTINGS_POLL_MILLISECONDS
		}
		const period = settings.periodSeconds * MILLISECONDS_PER_SECOND
		const lastStartedAt = await this.runs.lastStartedAt()
		const dueIn = lastStartedAt === undefined ? 0 : lastStartedAt.getTime() + period - now.getTime()
		if (dueIn > 0) {
			return Math.min(dueIn, SETTINGS_POLL_MILLISECONDS)
		}
		await this.sync.run(source, settings, now)
		return Math.min(period, SETTINGS_POLL_MILLISECONDS)
	}

	private warnOnceAboutSource(): void {
		if (this.warnedAboutSource) {
			return
		}
		this.warnedAboutSource = true
		this.logger.warn("Registry sync has a period but the PACS connection is not configured")
	}

	private schedule(delay: number): void {
		if (this.stopped) {
			return
		}
		this.timer = setTimeout(() => void this.tick(), delay)
	}

	private async tick(): Promise<void> {
		let delay = SETTINGS_POLL_MILLISECONDS
		try {
			delay = await this.runWhenDue(new Date())
		} catch (error) {
			this.logger.error("The registry sync cycle failed", error)
		}
		this.schedule(delay)
	}
}
