import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ARCHIVE_OUTCOME_CLASS } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { DatabaseService } from "../../../libs/database/database.service"
import { DeliveryAlertRepository } from "../repositories/delivery-alert.repository"
import { DeliveryTargetRepository } from "../repositories/delivery-target.repository"
import type { DeliverySettings } from "../types/delivery.types"
import { targetUnavailabilityMessageOf } from "../utils/delivery-alert"
import { deliveryAlertEventOf, targetEventOf } from "../utils/delivery-audit"

// CAP-023-R06, CAP-023-R24, CAP-023-R27, dorucovaci-jadro.md 5.3
@Injectable()
export class TargetWatchService {
	private readonly logger = new Logger(TargetWatchService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly targets: DeliveryTargetRepository,
		private readonly alerts: DeliveryAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	// ADR-005 ř. 36
	async watch(settings: DeliverySettings): Promise<void> {
		for (const target of await this.targets.unavailable()) {
			const echo = await settings.archive.checkAvailability(undefined)
			if (echo.classification.outcomeClass === ARCHIVE_OUTCOME_CLASS.SUCCESS) {
				await this.release(target.code)
				continue
			}
			await this.alertLongOutage(target.code, settings.unavailableAlertSeconds)
		}
	}

	// CAP-023-R24, CAP-023-S13, CAP-023-S23
	private async release(code: string): Promise<void> {
		const isReleased = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (!(await this.targets.release(tx, code))) {
				return false
			}
			await this.alerts.resolveForTarget(tx, ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY, code)
			await this.audit.appendSystemJob(tx, targetEventOf(AUDIT_EVENT_TYPE.TARGET_RELEASED, code, undefined), new Date())
			return true
		})
		if (isReleased) {
			this.logger.log(`Delivery target ${code} answers C-ECHO again; delivery resumes`)
		}
	}

	// CAP-023-R27, CAP-023-S22
	private async alertLongOutage(code: string, alertSeconds: number): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const outage = await this.targets.markUnavailabilityAlerted(tx, code, alertSeconds)
			if (outage === undefined) {
				return
			}
			const message = targetUnavailabilityMessageOf(alertSeconds)
			const kind = ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY
			const alertId = await this.alerts.raiseForTarget(tx, kind, code, message)
			const now = new Date()
			const details = { unavailable_since: outage.changed_at.toISOString(), alert_seconds: alertSeconds }
			await this.audit.appendSystemJob(
				tx,
				targetEventOf(AUDIT_EVENT_TYPE.TARGET_UNAVAILABILITY_ALERT, code, undefined, details),
				now,
			)
			if (alertId !== undefined) {
				await this.audit.appendSystemJob(tx, deliveryAlertEventOf(alertId, kind, message, { target_code: code }), now)
			}
		})
	}
}
