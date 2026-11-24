import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { DatabaseService } from "../../../libs/database/database.service"
import { AssemblyAlertRepository } from "../repositories/assembly-alert.repository"
import type { AssemblyPause } from "../types/assembly.types"
import { assemblyPauseEventOf, assemblyPauseMessageOf } from "../utils/assembly-alert"

// CAP-021-R41, CAP-028-R15, datovy-model.md 4 „Upozornění správce“
@Injectable()
export class AssemblyPauseService {
	private readonly logger = new Logger(AssemblyPauseService.name)
	private announcedPause: AssemblyPause | undefined
	private hasResumed = false

	constructor(
		private readonly database: DatabaseService,
		private readonly alerts: AssemblyAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async paused(pause: AssemblyPause): Promise<void> {
		if (this.announcedPause === pause) {
			return
		}
		this.announcedPause = pause
		this.hasResumed = false
		const message = assemblyPauseMessageOf(pause)
		try {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const alertId = await this.alerts.raisePause(tx, message)
				if (alertId !== undefined) {
					await this.audit.appendSystemJob(tx, assemblyPauseEventOf(alertId, message, pause), new Date())
				}
			})
		} catch (error) {
			this.announcedPause = undefined
			throw error
		}
		this.logger.warn(`Assembly waits for the configuration: ${pause}`)
	}

	async resumed(): Promise<void> {
		if (this.hasResumed) {
			return
		}
		this.hasResumed = true
		this.announcedPause = undefined
		try {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => await this.alerts.resolvePause(tx))
		} catch (error) {
			this.hasResumed = false
			throw error
		}
	}
}
