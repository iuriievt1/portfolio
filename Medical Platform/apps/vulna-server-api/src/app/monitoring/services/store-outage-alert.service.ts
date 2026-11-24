import { ADMINISTRATOR_ALERT_KIND, DEPENDENCY_STATE, SYSTEM_JOB } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { STORE_OUTAGE_ALERT_SECONDS } from "../constants/monitoring.constants"
import { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import { alertRaisedEventOf } from "../utils/alert-audit-event"
import { storeOutageMessageOf } from "../utils/alert-messages"

// CAP-028-R15, CAP-028-R22, CAP-028-S09
@Injectable()
export class StoreOutageAlertService {
	private alertedOutageStart: number | undefined
	private isResolutionPending = true

	constructor(
		private readonly database: DatabaseService,
		private readonly dependencies: DependencyStateService,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async evaluate(): Promise<void> {
		const store = this.dependencies.clinicalRecordStore
		const unavailableSince = store.unavailableSince()
		if (this.alertedOutageStart !== undefined && unavailableSince !== this.alertedOutageStart) {
			await this.resolve()
		}
		if (unavailableSince === undefined) {
			if (store.state() === DEPENDENCY_STATE.AVAILABLE) {
				await this.resolve()
			}
			return
		}
		const outageSeconds = store.outageSeconds()
		if (
			outageSeconds === undefined ||
			outageSeconds < STORE_OUTAGE_ALERT_SECONDS ||
			this.alertedOutageStart === unavailableSince
		) {
			return
		}
		await this.raise(new Date(unavailableSince))
		this.alertedOutageStart = unavailableSince
		this.isResolutionPending = true
	}

	private async raise(unavailableSince: Date): Promise<void> {
		const message = storeOutageMessageOf(unavailableSince)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const alertId = await this.alerts.raiseStoreUnavailable(tx, message)
			if (alertId === undefined) {
				return
			}
			const alert = {
				alertId,
				kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_STORE_UNAVAILABLE,
				message,
				subject: { unavailable_since: unavailableSince.toISOString() },
			}
			await this.audit.append(tx, alertRaisedEventOf(alert, SYSTEM_JOB.DEPENDENCY_MONITORING))
		})
	}

	private async resolve(): Promise<void> {
		if (!this.isResolutionPending) {
			return
		}
		await this.alerts.resolveStoreUnavailable()
		this.isResolutionPending = false
		this.alertedOutageStart = undefined
	}
}
