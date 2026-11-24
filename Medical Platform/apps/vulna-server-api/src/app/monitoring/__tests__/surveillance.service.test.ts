import { ADMINISTRATOR_ALERT_KIND, DEPENDENCY_STATE, MONITORED_DEPENDENCY } from "@ansora/contracts"
import type { ClinicalRecordStorePort } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { ClinicalRecordStoreService } from "../../clinical-record/services/clinical-record-store.service"
import type { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import type { OperationalMetricsRepository } from "../repositories/operational-metrics.repository"
import { OperationalMetricsService } from "../services/operational-metrics.service"
import { SurveillanceService } from "../services/surveillance.service"
import type { OperationalMetricsRow } from "../types/monitoring.types"

const NOW = Date.UTC(2026, 9, 27, 10, 0, 0)
const MINUTE = 60_000

const ROW: OperationalMetricsRow = {
	write_waiting: 2,
	write_failed: 1,
	upload_waiting: 4,
	upload_failed: 0,
	oldest_open_upload_at: new Date(NOW - 15 * MINUTE),
	buffer_bytes: "3221225472",
	buffer_files_waiting_for_deletion: 12,
	delivery_waiting: 6,
	delivery_permanently_failed: 1,
	delivery_held_for_review: 2,
	delivery_assembly_failed: 1,
	devices_pending_approval: 3,
	devices_revoked: 5,
}

function harness(isDatabaseUp: boolean, isMetricsQueryStuck = false) {
	const dependencies = new DependencyStateService()
	const sql = (() =>
		isDatabaseUp ? Promise.resolve([]) : Promise.reject(new Error("ECONNREFUSED"))) as unknown as postgres.Sql
	const database = { sql } as unknown as DatabaseService
	const metricsRow = (): Promise<OperationalMetricsRow> => {
		if (!isDatabaseUp) {
			return Promise.reject(new Error("ECONNREFUSED"))
		}
		return isMetricsQueryStuck ? new Promise(() => {}) : Promise.resolve(ROW)
	}
	const repository = { current: metricsRow } as unknown as OperationalMetricsRepository
	const configuredStore = async () => {
		if (!isDatabaseUp) {
			throw new Error("the configuration lives in the database")
		}
		return {} as ClinicalRecordStorePort
	}
	const stores = { current: configuredStore } as unknown as ClinicalRecordStoreService
	const alerts = {
		activeCounts: async () => [{ kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_STORE_UNAVAILABLE, count: 1 }],
	} as unknown as AdministratorAlertRepository
	const metrics = new OperationalMetricsService(repository, dependencies, stores)
	return { service: new SurveillanceService(database, dependencies, metrics, alerts), dependencies }
}

describe("SurveillanceService", () => {
	it("CAP-028-S01 hands the monitoring system the metrics of the instance in OpenMetrics", async () => {
		const { service, dependencies } = harness(true)
		dependencies.clinicalRecordStore.recordRejectedRequest(NOW - 6 * MINUTE)
		dependencies.clinicalRecordStore.recordRejectedRequest(NOW)

		const text = await service.metricsText(NOW)

		expect(text).toContain('vulna_dependency{dependency="database",vulna_dependency="available"} 1')
		expect(text).toContain('vulna_dependency{dependency="clinical_record_store",vulna_dependency="unavailable"} 1')
		expect(text).toContain('vulna_dependency{dependency="identity_provider",vulna_dependency="unknown"} 1')
		expect(text).toContain("vulna_clinical_record_rejected_requests_total 2")
		expect(text).toContain("vulna_clinical_record_outage_seconds 360")
		expect(text).toContain('vulna_administrator_alerts_active{kind="clinical_record_store_unavailable"} 1')
		expect(text).toContain('vulna_administrator_alerts_active{kind="audit_chain_broken"} 0')
		expect(text).toContain('vulna_clinical_record_write_tasks{state="waiting"} 2')
		expect(text).toContain('vulna_clinical_record_upload_tasks{state="failed"} 0')
		expect(text).toContain("vulna_clinical_record_upload_lag_seconds 900")
		expect(text).toContain("vulna_binary_buffer_bytes 3221225472")
		expect(text).toContain("vulna_binary_buffer_files_waiting_for_deletion 12")
		expect(text).toContain('vulna_devices{state="pending_approval"} 3')
		expect(text.endsWith("# EOF\n")).toBe(true)
	})

	it("CAP-028-R12, CAP-023-S27 counts delivery instances under the neutral name of the held state and failed assemblies apart", async () => {
		const { service } = harness(true)

		const text = await service.metricsText(NOW)

		expect(text).toContain('vulna_delivery_instances{state="waiting"} 6')
		expect(text).toContain('vulna_delivery_instances{state="permanently_failed"} 1')
		expect(text).toContain('vulna_delivery_instances{state="held_for_review"} 2')
		expect(text).toContain('vulna_deliveries{state="assembly_failed"} 1')
	})

	it("CAP-028-S04 still reports the dependencies when the database is down", async () => {
		const { service } = harness(false)

		const text = await service.metricsText(NOW)

		expect(text).toContain('vulna_dependency{dependency="database",vulna_dependency="unavailable"} 1')
		expect(text).toContain("vulna_clinical_record_rejected_requests_total 0")
		expect(text).not.toContain("vulna_clinical_record_write_tasks")
		expect(text).not.toContain("vulna_administrator_alerts_active")
		expect(await service.dependencyStates()).toEqual({
			[MONITORED_DEPENDENCY.DATABASE]: DEPENDENCY_STATE.UNAVAILABLE,
			[MONITORED_DEPENDENCY.IDENTITY_PROVIDER]: DEPENDENCY_STATE.UNKNOWN,
			[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: DEPENDENCY_STATE.UNKNOWN,
		})
	})

	it("CAP-028-R21 reports the database unavailable when its figures do not come in time", async () => {
		const { service } = harness(true, true)

		const text = await service.metricsText(NOW)

		expect(text).toContain('vulna_dependency{dependency="database",vulna_dependency="unavailable"} 1')
		expect(text).not.toContain("vulna_clinical_record_write_tasks")
	})

	it("leaves out the outage while the store answers", async () => {
		const { service, dependencies } = harness(true)
		dependencies.clinicalRecordStore.recordAnswer()

		const text = await service.metricsText(NOW)

		expect(text).toContain("# TYPE vulna_clinical_record_outage_seconds gauge")
		expect(text.split("\n").filter((line) => line.startsWith("vulna_clinical_record_outage_seconds"))).toEqual([])
	})
})
