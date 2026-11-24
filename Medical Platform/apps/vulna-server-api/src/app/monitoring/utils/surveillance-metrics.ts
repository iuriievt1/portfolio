import { ADMINISTRATOR_ALERT_KIND, DELIVERY_INSTANCE_STATE, DELIVERY_STATE } from "@ansora/contracts"
import {
	DEVICE_STATE,
	dependencyStateFamily,
	JOB_STATE,
	METRIC_TYPE,
	type MetricFamily,
	type MetricSample,
} from "@ansora/core-server"
import type { ActiveAlertCountRow, OperationalMetricsView, SurveillanceSnapshot } from "../types/monitoring.types"

const STATE_LABEL = "state"
const KIND_LABEL = "kind"
const SECONDS = "seconds"
const BYTES = "bytes"

function single(value: number | null | undefined): MetricSample[] {
	return value === null || value === undefined ? [] : [{ labels: {}, value }]
}

function byState(entries: readonly [string, number | undefined][]): MetricSample[] {
	return entries.flatMap(([state, value]) => (value === undefined ? [] : [{ labels: { [STATE_LABEL]: state }, value }]))
}

// CAP-028-R15
function activeAlertsFamily(activeAlerts: readonly ActiveAlertCountRow[]): MetricFamily {
	const counts = new Map(activeAlerts.map((row) => [row.kind, row.count]))
	return {
		name: "vulna_administrator_alerts_active",
		type: METRIC_TYPE.GAUGE,
		help: "Administrator alerts whose cause lasts",
		unit: undefined,
		samples: Object.values(ADMINISTRATOR_ALERT_KIND).map((kind) => ({
			labels: { [KIND_LABEL]: kind },
			value: counts.get(kind) ?? 0,
		})),
	}
}

// CAP-028-R12, CAP-028-R13, CAP-028-R22, CAP-023-S27
function operationalFamilies(metrics: OperationalMetricsView): MetricFamily[] {
	const writes = metrics.clinical_record_store
	const uploads = metrics.clinical_record_binary_upload
	const deliveries = metrics.delivery_queue
	return [
		{
			name: "vulna_clinical_record_write_tasks",
			type: METRIC_TYPE.GAUGE,
			help: "Queued writes to the clinical record store by state",
			unit: undefined,
			samples: byState([
				[JOB_STATE.WAITING, writes?.waiting],
				[JOB_STATE.FAILED, writes?.failed],
			]),
		},
		{
			name: "vulna_clinical_record_upload_tasks",
			type: METRIC_TYPE.GAUGE,
			help: "Uploads of image bytes to the clinical record store by state",
			unit: undefined,
			samples: byState([
				[JOB_STATE.WAITING, uploads?.waiting],
				[JOB_STATE.FAILED, uploads?.failed],
			]),
		},
		{
			name: "vulna_clinical_record_upload_lag_seconds",
			type: METRIC_TYPE.GAUGE,
			help: "Age of the oldest unfinished upload",
			unit: SECONDS,
			samples: single(uploads?.upload_lag_seconds),
		},
		{
			name: "vulna_binary_buffer_bytes",
			type: METRIC_TYPE.GAUGE,
			help: "Bytes held in the buffer of the server",
			unit: BYTES,
			samples: single(metrics.binary_buffer?.size_bytes),
		},
		{
			name: "vulna_binary_buffer_files_waiting_for_deletion",
			type: METRIC_TYPE.GAUGE,
			help: "Files of closed records the buffer keeps until both deletion conditions hold",
			unit: undefined,
			samples: single(metrics.binary_buffer?.files_waiting_for_deletion_conditions),
		},
		{
			name: "vulna_delivery_instances",
			type: METRIC_TYPE.GAUGE,
			help: "Delivery instances waiting, failed for good or held for review",
			unit: undefined,
			samples: byState([
				[DELIVERY_INSTANCE_STATE.WAITING, deliveries?.waiting],
				[DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED, deliveries?.permanently_failed],
				[DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW, deliveries?.held_for_review],
			]),
		},
		{
			name: "vulna_deliveries",
			type: METRIC_TYPE.GAUGE,
			help: "Deliveries whose assembly failed",
			unit: undefined,
			samples: byState([[DELIVERY_STATE.ASSEMBLY_FAILED, deliveries?.assembly_failed]]),
		},
		{
			name: "vulna_devices",
			type: METRIC_TYPE.GAUGE,
			help: "Devices waiting for approval and revoked devices",
			unit: undefined,
			samples: byState([
				[DEVICE_STATE.PENDING_APPROVAL, metrics.device?.pending_approval],
				[DEVICE_STATE.REVOKED, metrics.device?.revoked],
			]),
		},
	]
}

// CAP-028-R09, CAP-028-R10, CAP-028-R22, CAP-028-S01, CAP-028-S10
export function surveillanceFamiliesOf(snapshot: SurveillanceSnapshot): MetricFamily[] {
	const families = [
		dependencyStateFamily(snapshot.dependencies),
		{
			name: "vulna_clinical_record_rejected_requests",
			type: METRIC_TYPE.COUNTER,
			help: "Requests rejected with documentation-unavailable because the store failed",
			unit: undefined,
			samples: single(snapshot.rejectedRequestTotal),
		},
		{
			name: "vulna_clinical_record_outage_seconds",
			type: METRIC_TYPE.GAUGE,
			help: "How long calls to the clinical record store have failed without an answer",
			unit: SECONDS,
			samples: single(snapshot.outageSeconds),
		},
	]
	if (snapshot.activeAlerts !== undefined) {
		families.push(activeAlertsFamily(snapshot.activeAlerts))
	}
	if (snapshot.operational !== undefined) {
		families.push(...operationalFamilies(snapshot.operational))
	}
	return families
}
