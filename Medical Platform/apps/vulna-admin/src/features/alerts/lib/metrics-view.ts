import {
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	DEPENDENCY_STATE,
	type DependencyState,
	MONITORED_DEPENDENCY,
	type MonitoredDependency,
} from "@ansora/contracts"
import { pacsStatusText } from "@/features/acquisitions/lib/acquisition-text"
import type { OperationalMetrics } from "@/features/alerts/types/alert.types"
import { deliveriesPathOf } from "@/features/deliveries/lib/delivery-filter"
import { deliveryStateText } from "@/features/deliveries/lib/delivery-text"
import { PENDING_APPROVAL } from "@/features/devices/constants/device-state"
import { devicesPathOf } from "@/features/devices/lib/device-filter"
import cs from "@/i18n/cs.json"
import { formatBytes, formatCount, formatElapsed } from "@/lib/format"

const texts = cs.alerts.metrics

interface MetricField {
	term: string
	value: string
}

export interface AttentionTile {
	label: string
	count: number | undefined
	to: string
}

interface DependencyField {
	term: string
	state: DependencyState
}

const DEPENDENCY_TEXT: Readonly<Record<MonitoredDependency, string>> = {
	[MONITORED_DEPENDENCY.DATABASE]: texts.dependencies.database,
	[MONITORED_DEPENDENCY.IDENTITY_PROVIDER]: texts.dependencies.identity_provider,
	[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: texts.dependencies.clinical_record_store,
}

export const DEPENDENCY_STATE_TEXT: Readonly<Record<DependencyState, string>> = texts.dependencyState

function countText(count: number | undefined): string {
	return count === undefined ? texts.notReported : formatCount(count)
}

function elapsedText(seconds: number | null | undefined, whenNone: string): string {
	if (seconds === undefined) {
		return texts.notReported
	}
	return seconds === null ? whenNone : formatElapsed(seconds)
}

// CAP-028-R05, CAP-028-R20
export function dependencyFieldsOf(metrics: OperationalMetrics): DependencyField[] {
	return Object.values(MONITORED_DEPENDENCY).map((dependency) => ({
		term: DEPENDENCY_TEXT[dependency],
		state: metrics.dependencies?.[dependency] ?? DEPENDENCY_STATE.UNKNOWN,
	}))
}

// CAP-028-R22, CAP-028-S09
export function clinicalRecordStoreFieldsOf(metrics: OperationalMetrics): MetricField[] {
	const store = metrics.clinical_record_store
	const fieldTexts = texts.clinicalRecordStore
	return [
		{ term: fieldTexts.rejectedRequests, value: countText(store?.rejected_request_count) },
		{ term: fieldTexts.outage, value: elapsedText(store?.rejected_request_seconds, fieldTexts.noOutage) },
		{ term: fieldTexts.waiting, value: countText(store?.waiting) },
		{ term: fieldTexts.failed, value: countText(store?.failed) },
	]
}

// CAP-028-R22, CAP-028-S10, CAP-026-R18
export function imageDataFieldsOf(metrics: OperationalMetrics): MetricField[] {
	const upload = metrics.clinical_record_binary_upload
	const buffer = metrics.binary_buffer
	const fieldTexts = texts.imageData
	return [
		{ term: fieldTexts.uploadWaiting, value: countText(upload?.waiting) },
		{ term: fieldTexts.uploadFailed, value: countText(upload?.failed) },
		{ term: fieldTexts.uploadLag, value: elapsedText(upload?.upload_lag_seconds, fieldTexts.noUploadWaiting) },
		{
			term: fieldTexts.bufferSize,
			value: buffer?.size_bytes === undefined ? texts.notReported : formatBytes(buffer.size_bytes),
		},
		{ term: fieldTexts.filesWaiting, value: countText(buffer?.files_waiting_for_deletion_conditions) },
	]
}

// CAP-028-R12, CAP-023-R09, CAP-022-R11
export function deliveryQueueFieldsOf(metrics: OperationalMetrics): MetricField[] {
	const queue = metrics.delivery_queue
	return [
		{ term: pacsStatusText(DELIVERY_INSTANCE_STATE.WAITING), value: countText(queue?.waiting) },
		{ term: pacsStatusText(DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED), value: countText(queue?.permanently_failed) },
		{ term: pacsStatusText(DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW), value: countText(queue?.held_for_review) },
		{ term: deliveryStateText(DELIVERY_STATE.ASSEMBLY_FAILED), value: countText(queue?.assembly_failed) },
	]
}

// CAP-028-R13
export function deviceFieldsOf(metrics: OperationalMetrics): MetricField[] {
	return [
		{ term: texts.devices.pendingApproval, value: countText(metrics.device?.pending_approval) },
		{ term: texts.devices.revoked, value: countText(metrics.device?.revoked) },
	]
}

// CAP-028-R12, CAP-028-R13
export function attentionTilesOf(metrics: OperationalMetrics): AttentionTile[] {
	const queue = metrics.delivery_queue
	const tileTexts = texts.attention
	return [
		{
			label: tileTexts.pendingApproval,
			count: metrics.device?.pending_approval,
			to: devicesPathOf(PENDING_APPROVAL),
		},
		{
			label: tileTexts.waiting,
			count: queue?.waiting,
			to: deliveriesPathOf({ state: undefined, instanceState: DELIVERY_INSTANCE_STATE.WAITING }),
		},
		{
			label: tileTexts.assemblyFailed,
			count: queue?.assembly_failed,
			to: deliveriesPathOf({ state: DELIVERY_STATE.ASSEMBLY_FAILED, instanceState: undefined }),
		},
		{
			label: tileTexts.permanentlyFailed,
			count: queue?.permanently_failed,
			to: deliveriesPathOf({ state: undefined, instanceState: DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED }),
		},
		{
			label: tileTexts.heldForReview,
			count: queue?.held_for_review,
			to: deliveriesPathOf({ state: undefined, instanceState: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW }),
		},
	]
}
