import { DEPENDENCY_STATE, type DependencyState, type MonitoredDependency } from "@ansora/contracts"
import { answeredWithin, databaseAnswers, openMetricsText } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import type { SurveillanceSnapshot } from "../types/monitoring.types"
import { surveillanceFamiliesOf } from "../utils/surveillance-metrics"
import { OperationalMetricsService } from "./operational-metrics.service"

// CAP-028-R05, CAP-028-R09, CAP-028-R10, CAP-028-R20
@Injectable()
export class SurveillanceService {
	constructor(
		private readonly database: DatabaseService,
		private readonly dependencies: DependencyStateService,
		private readonly metrics: OperationalMetricsService,
		private readonly alerts: AdministratorAlertRepository,
	) {}

	// CAP-028-R21, CAP-028-S04
	async dependencyStates(): Promise<Record<MonitoredDependency, DependencyState>> {
		const states = (await databaseAnswers(this.database.sql))
			? await answeredWithin(this.metrics.dependencyStates(DEPENDENCY_STATE.AVAILABLE))
			: undefined
		return states ?? (await this.metrics.dependencyStates(DEPENDENCY_STATE.UNAVAILABLE))
	}

	async metricsText(now: number): Promise<string> {
		return openMetricsText(surveillanceFamiliesOf(await this.snapshot(now)))
	}

	// CAP-028-R21, CAP-028-S04
	private async snapshot(now: number): Promise<SurveillanceSnapshot> {
		const store = this.dependencies.clinicalRecordStore
		const inMemory = { rejectedRequestTotal: store.rejectedRequestTotal(), outageSeconds: store.outageSeconds() }
		const fromDatabase = await answeredWithin(this.figuresFromDatabase(now))
		if (fromDatabase !== undefined) {
			return { ...inMemory, ...fromDatabase }
		}
		return {
			...inMemory,
			operational: undefined,
			dependencies: await this.metrics.dependencyStates(DEPENDENCY_STATE.UNAVAILABLE),
			activeAlerts: undefined,
		}
	}

	private async figuresFromDatabase(
		now: number,
	): Promise<Pick<SurveillanceSnapshot, "operational" | "dependencies" | "activeAlerts">> {
		const operational = await this.metrics.current(now)
		return {
			operational,
			dependencies: operational.dependencies ?? {},
			activeAlerts: await this.alerts.activeCounts(),
		}
	}
}
