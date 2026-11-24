import {
	DEPENDENCY_STATE,
	type DependencyState,
	MONITORED_DEPENDENCY,
	type MonitoredDependency,
} from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { ClinicalRecordStoreService } from "../../clinical-record/services/clinical-record-store.service"
import { OperationalMetricsRepository } from "../repositories/operational-metrics.repository"
import type { OperationalMetricsView } from "../types/monitoring.types"

function secondsSince(moment: Date | null, now: number): number | null {
	return moment === null ? null : Math.max(0, Math.floor((now - moment.getTime()) / MILLISECONDS_PER_SECOND))
}

// administration.yaml getOperationalMetricsForAdministration, CAP-028-R13, CAP-028-R20, CAP-028-R22
@Injectable()
export class OperationalMetricsService {
	constructor(
		private readonly metrics: OperationalMetricsRepository,
		private readonly dependencies: DependencyStateService,
		private readonly stores: ClinicalRecordStoreService,
	) {}

	async current(now: number): Promise<OperationalMetricsView> {
		const row = await this.metrics.current()
		const store = this.dependencies.clinicalRecordStore
		return {
			clinical_record_store: {
				waiting: row.write_waiting,
				failed: row.write_failed,
				rejected_request_count: store.rejectedRequestCount(),
				rejected_request_seconds: store.outageSeconds() ?? null,
			},
			clinical_record_binary_upload: {
				waiting: row.upload_waiting,
				failed: row.upload_failed,
				upload_lag_seconds: secondsSince(row.oldest_open_upload_at, now),
			},
			binary_buffer: {
				size_bytes: Number(row.buffer_bytes),
				files_waiting_for_deletion_conditions: row.buffer_files_waiting_for_deletion,
			},
			// Q-141
			object_storage: { used_bytes: null, capacity_bytes: null },
			// CAP-028-R12, CAP-023-R09, CAP-022-R11
			delivery_queue: {
				waiting: row.delivery_waiting,
				permanently_failed: row.delivery_permanently_failed,
				held_for_review: row.delivery_held_for_review,
				assembly_failed: row.delivery_assembly_failed,
			},
			device: { pending_approval: row.devices_pending_approval, revoked: row.devices_revoked },
			dependencies: await this.dependencyStates(DEPENDENCY_STATE.AVAILABLE),
		}
	}

	// CAP-028-R05, CAP-028-R20
	async dependencyStates(database: DependencyState): Promise<Record<MonitoredDependency, DependencyState>> {
		return {
			[MONITORED_DEPENDENCY.DATABASE]: database,
			[MONITORED_DEPENDENCY.IDENTITY_PROVIDER]: this.dependencies.identityProvider.state(),
			[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: await this.storeState(database),
		}
	}

	private async storeState(database: DependencyState): Promise<DependencyState> {
		if (database === DEPENDENCY_STATE.AVAILABLE && (await this.stores.current()) === undefined) {
			return DEPENDENCY_STATE.UNAVAILABLE
		}
		return this.dependencies.clinicalRecordStore.state()
	}
}
