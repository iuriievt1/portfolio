import type { SyslogSettings } from "@ansora/vulna-adapter-syslog"
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import {
	AUDIT_SINK_FACTORY,
	EXPORT_BATCH_SIZE,
	EXPORT_CYCLE,
	EXPORT_POLL_MILLISECONDS,
	EXPORT_RETRY_MILLISECONDS,
	type ExportCycle,
} from "../constants/audit-export.constants"
import { AuditExportRepository } from "../repositories/audit-export.repository"
import type { AuditSinkFactory } from "../types/audit-export.types"
import { exportFailureOf } from "../utils/export-failure"
import { SyslogSettingsService } from "./syslog-settings.service"

const NEXT_RUN_AFTER: Readonly<Record<ExportCycle, number>> = {
	[EXPORT_CYCLE.MORE_WAITING]: 0,
	[EXPORT_CYCLE.CAUGHT_UP]: EXPORT_POLL_MILLISECONDS,
	[EXPORT_CYCLE.NOT_CONFIGURED]: EXPORT_POLL_MILLISECONDS,
	[EXPORT_CYCLE.HELD_ELSEWHERE]: EXPORT_POLL_MILLISECONDS,
	[EXPORT_CYCLE.FAILED]: EXPORT_RETRY_MILLISECONDS,
}

// CAP-025-R08, CAP-025-R09, CAP-025-R11, CAP-025-S03
@Injectable()
export class AuditExportService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(AuditExportService.name)
	private timer: NodeJS.Timeout | undefined
	private stopped = false

	constructor(
		private readonly database: DatabaseService,
		private readonly repository: AuditExportRepository,
		private readonly settings: SyslogSettingsService,
		@Inject(AUDIT_SINK_FACTORY) private readonly sinkFor: AuditSinkFactory,
	) {}

	onApplicationBootstrap(): void {
		this.schedule(0)
	}

	onApplicationShutdown(): void {
		this.stopped = true
		clearTimeout(this.timer)
	}

	async exportPending(): Promise<ExportCycle> {
		const settings = await this.settings.current()
		if (settings === undefined) {
			return EXPORT_CYCLE.NOT_CONFIGURED
		}
		return await this.database.sql.begin((tx: postgres.TransactionSql) => this.exportBatch(tx, settings))
	}

	private async exportBatch(tx: postgres.TransactionSql, settings: SyslogSettings): Promise<ExportCycle> {
		if (!(await this.repository.lock(tx))) {
			return EXPORT_CYCLE.HELD_ELSEWHERE
		}
		const records = await this.repository.recordsAfter(
			tx,
			await this.repository.exportedSequence(tx),
			EXPORT_BATCH_SIZE,
		)
		const last = records.at(-1)
		if (last === undefined) {
			return EXPORT_CYCLE.CAUGHT_UP
		}
		try {
			await this.sinkFor(settings).export(records)
		} catch (error) {
			const failure = exportFailureOf(error)
			await this.repository.recordFailure(tx, failure, new Date())
			this.logger.warn(`Audit export to ${settings.host}:${settings.port} failed (${failure}): ${String(error)}`)
			return EXPORT_CYCLE.FAILED
		}
		await this.repository.recordDelivery(tx, last.sequence, new Date())
		return records.length === EXPORT_BATCH_SIZE ? EXPORT_CYCLE.MORE_WAITING : EXPORT_CYCLE.CAUGHT_UP
	}

	private schedule(delay: number): void {
		if (this.stopped) {
			return
		}
		this.timer = setTimeout(() => void this.run(), delay)
	}

	private async run(): Promise<void> {
		let cycle: ExportCycle = EXPORT_CYCLE.FAILED
		try {
			cycle = await this.exportPending()
		} catch (error) {
			this.logger.error("The audit export cycle failed", error)
		}
		this.schedule(NEXT_RUN_AFTER[cycle])
	}
}
