import { DEPENDENCY_STATE, MONITORED_DEPENDENCY } from "@ansora/contracts"
import type { ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { ClinicalRecordStoreService } from "../../clinical-record/services/clinical-record-store.service"
import type { OperationalMetricsRepository } from "../repositories/operational-metrics.repository"
import { OperationalMetricsService } from "../services/operational-metrics.service"
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

function serviceWith(row: OperationalMetricsRow, store: ClinicalRecordStorePort | undefined) {
	const dependencies = new DependencyStateService()
	const metrics = { current: async () => row } as unknown as OperationalMetricsRepository
	const stores = { current: async () => store } as unknown as ClinicalRecordStoreService
	return { service: new OperationalMetricsService(metrics, dependencies, stores), dependencies }
}

describe("OperationalMetricsService", () => {
	it("CAP-028-R12, CAP-028-R13 hands the counts of queues, buffer, deliveries and devices to the administration", async () => {
		const { service, dependencies } = serviceWith(ROW, {} as ClinicalRecordStorePort)
		dependencies.clinicalRecordStore.recordAnswer()
		dependencies.identityProvider.recordAnswer()

		expect(await service.current(NOW)).toEqual({
			clinical_record_store: { waiting: 2, failed: 1, rejected_request_count: 0, rejected_request_seconds: null },
			clinical_record_binary_upload: { waiting: 4, failed: 0, upload_lag_seconds: 900 },
			binary_buffer: { size_bytes: 3_221_225_472, files_waiting_for_deletion_conditions: 12 },
			object_storage: { used_bytes: null, capacity_bytes: null },
			delivery_queue: { waiting: 6, permanently_failed: 1, held_for_review: 2, assembly_failed: 1 },
			device: { pending_approval: 3, revoked: 5 },
			dependencies: {
				[MONITORED_DEPENDENCY.DATABASE]: DEPENDENCY_STATE.AVAILABLE,
				[MONITORED_DEPENDENCY.IDENTITY_PROVIDER]: DEPENDENCY_STATE.AVAILABLE,
				[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: DEPENDENCY_STATE.AVAILABLE,
			},
		})
	})

	it("CAP-028-S09 shows the outage of the store with the rejected requests", async () => {
		const { service, dependencies } = serviceWith(ROW, {} as ClinicalRecordStorePort)
		dependencies.clinicalRecordStore.recordRejectedRequest(NOW - 10 * MINUTE)
		dependencies.clinicalRecordStore.recordRejectedRequest(NOW)

		const metrics = await service.current(NOW)

		expect(metrics.clinical_record_store).toMatchObject({ rejected_request_count: 2, rejected_request_seconds: 600 })
		expect(metrics.dependencies?.[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]).toBe(DEPENDENCY_STATE.UNAVAILABLE)
	})

	it("shows no upload delay when no upload waits", async () => {
		const { service } = serviceWith({ ...ROW, upload_waiting: 0, oldest_open_upload_at: null }, undefined)

		const metrics = await service.current(NOW)

		expect(metrics.clinical_record_binary_upload?.upload_lag_seconds).toBeNull()
	})

	it("CAP-028-R20 reports an unconfigured store as unavailable and an uncalled provider as unknown", async () => {
		const { service } = serviceWith(ROW, undefined)

		const metrics = await service.current(NOW)

		expect(metrics.dependencies).toEqual({
			[MONITORED_DEPENDENCY.DATABASE]: DEPENDENCY_STATE.AVAILABLE,
			[MONITORED_DEPENDENCY.IDENTITY_PROVIDER]: DEPENDENCY_STATE.UNKNOWN,
			[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: DEPENDENCY_STATE.UNAVAILABLE,
		})
	})
})
