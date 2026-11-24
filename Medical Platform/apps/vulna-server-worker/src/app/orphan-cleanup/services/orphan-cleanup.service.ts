import { CONFIGURATION_KEY, requiredIntegerOf, secondsAfter } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { OrphanAlertRepository } from "../repositories/orphan-alert.repository"
import { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import type { OrphanCleanupRun, SetAsideObjectRow } from "../types/orphan-cleanup.types"
import { orphanAlertMessageOf } from "../utils/orphan-alert-message"
import { orphanAlertEventOf, orphanSetAsideEventOf } from "../utils/orphan-audit"
import { UnrecordedBinaryService } from "./unrecorded-binary.service"

// CAP-026-R14, CAP-026-S06, CAP-026-S07, CAP-028-R15, dorucovaci-jadro.md 2, ADR-038
@Injectable()
export class OrphanCleanupService {
	constructor(
		private readonly database: DatabaseService,
		private readonly configuration: ConfigurationService,
		private readonly objects: OrphanedObjectRepository,
		private readonly unrecorded: UnrecordedBinaryService,
		private readonly alerts: OrphanAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async run(now: Date): Promise<OrphanCleanupRun> {
		const values = await this.configuration.effectiveValues()
		const setAsideAfterSeconds = requiredIntegerOf(values, CONFIGURATION_KEY.ORPHAN_SET_ASIDE_AFTER_SECONDS)
		const cutoff = secondsAfter(now, -setAsideAfterSeconds)
		const unrecorded = await this.unrecorded.storedBefore(cutoff)
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const setAside = [
				...(await this.objects.setAsideUnreferenced(tx, cutoff, now)),
				...(await this.objects.setAsideUnrecorded(tx, unrecorded, now)),
			]
			await this.record(tx, setAside, now)
			return { setAsideCount: setAside.length }
		})
	}

	// CAP-026-R14, CAP-028-R15, datovy-model.md 8
	private async record(tx: postgres.TransactionSql, setAside: readonly SetAsideObjectRow[], now: Date): Promise<void> {
		if (setAside.length === 0) {
			return
		}
		for (const object of setAside) {
			await this.audit.appendSystemJob(tx, orphanSetAsideEventOf(object), now)
		}
		const message = orphanAlertMessageOf(setAside.length)
		const alertId = await this.alerts.raise(tx, message, setAside.length)
		await this.audit.appendSystemJob(tx, orphanAlertEventOf(alertId, message, setAside.length), now)
	}
}
