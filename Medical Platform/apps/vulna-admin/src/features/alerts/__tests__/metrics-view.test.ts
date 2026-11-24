import { DEPENDENCY_STATE, MONITORED_DEPENDENCY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	attentionTilesOf,
	clinicalRecordStoreFieldsOf,
	deliveryQueueFieldsOf,
	dependencyFieldsOf,
	deviceFieldsOf,
	imageDataFieldsOf,
} from "@/features/alerts/lib/metrics-view"
import type { OperationalMetrics } from "@/features/alerts/types/alert.types"
import cs from "@/i18n/cs.json"
import { formatBytes, formatCount, formatElapsed } from "@/lib/format"

const texts = cs.alerts.metrics

const METRICS: OperationalMetrics = {
	clinical_record_store: { waiting: 2, failed: 1, rejected_request_count: 1250, rejected_request_seconds: 437 },
	clinical_record_binary_upload: { waiting: 4, failed: 0, upload_lag_seconds: 7200 },
	binary_buffer: { size_bytes: 3_221_225_472, files_waiting_for_deletion_conditions: 12 },
	object_storage: { used_bytes: null, capacity_bytes: null },
	device: { pending_approval: 3, revoked: 5 },
	dependencies: {
		[MONITORED_DEPENDENCY.DATABASE]: DEPENDENCY_STATE.AVAILABLE,
		[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: DEPENDENCY_STATE.UNAVAILABLE,
	},
}

describe("operational metrics on the alerts page", () => {
	it("CAP-028-R05 lists every dependency and treats one the server did not report as unknown", () => {
		expect(dependencyFieldsOf(METRICS)).toEqual([
			{ term: texts.dependencies.database, state: DEPENDENCY_STATE.AVAILABLE },
			{ term: texts.dependencies.identity_provider, state: DEPENDENCY_STATE.UNKNOWN },
			{ term: texts.dependencies.clinical_record_store, state: DEPENDENCY_STATE.UNAVAILABLE },
		])
	})

	it("CAP-028-S09 shows the rejected requests and how long the outage lasts", () => {
		expect(clinicalRecordStoreFieldsOf(METRICS)).toEqual([
			{ term: texts.clinicalRecordStore.rejectedRequests, value: formatCount(1250) },
			{ term: texts.clinicalRecordStore.outage, value: "7 minut" },
			{ term: texts.clinicalRecordStore.waiting, value: formatCount(2) },
			{ term: texts.clinicalRecordStore.failed, value: formatCount(1) },
		])
	})

	it("says there is no outage when the store answers", () => {
		const answering = {
			...METRICS,
			clinical_record_store: { ...METRICS.clinical_record_store, rejected_request_seconds: null },
		}

		expect(clinicalRecordStoreFieldsOf(answering)[1]?.value).toBe(texts.clinicalRecordStore.noOutage)
	})

	it("CAP-028-S10 shows the waiting uploads, their delay and the buffer of the server", () => {
		expect(imageDataFieldsOf(METRICS)).toEqual([
			{ term: texts.imageData.uploadWaiting, value: formatCount(4) },
			{ term: texts.imageData.uploadFailed, value: formatCount(0) },
			{ term: texts.imageData.uploadLag, value: formatElapsed(7200) },
			{ term: texts.imageData.bufferSize, value: formatBytes(3_221_225_472) },
			{ term: texts.imageData.filesWaiting, value: formatCount(12) },
		])
	})

	it("CAP-028-R12 shows the delivery queue with the deliveries held for review", () => {
		const fields = deliveryQueueFieldsOf({
			...METRICS,
			delivery_queue: { waiting: 6, permanently_failed: 1, held_for_review: 2, assembly_failed: 0 },
		})

		expect(fields).toEqual([
			{ term: "Čeká", value: formatCount(6) },
			{ term: "Trvale selhalo", value: formatCount(1) },
			{ term: "Čeká na posouzení", value: formatCount(2) },
			{ term: "Sestavení selhalo", value: formatCount(0) },
		])
	})

	it("CAP-028-R13 leads each tile to the list that holds what it counts", () => {
		const tiles = attentionTilesOf({
			...METRICS,
			delivery_queue: { waiting: 6, permanently_failed: 1, held_for_review: 2, assembly_failed: 0 },
		})

		expect(tiles.map((tile) => [tile.count, tile.to])).toEqual([
			[3, "/devices?state=pending_approval"],
			[6, "/deliveries?instance_state=waiting"],
			[0, "/deliveries?state=assembly_failed"],
			[1, "/deliveries?instance_state=permanently_failed"],
			[2, "/deliveries?instance_state=held_for_review"],
		])
	})

	it("keeps a tile the server did not report without a count", () => {
		const tiles = attentionTilesOf({ ...METRICS, device: undefined })

		expect(tiles[0]?.count).toBeUndefined()
	})

	it("marks a value the server did not report instead of showing zero", () => {
		const fields = deviceFieldsOf({ ...METRICS, device: undefined })

		expect(fields.map((field) => field.value)).toEqual([texts.notReported, texts.notReported])
	})
})
