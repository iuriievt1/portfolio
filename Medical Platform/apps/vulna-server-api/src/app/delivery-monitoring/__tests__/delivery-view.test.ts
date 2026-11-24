import {
	ACQUISITION_KIND,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	DELIVERY_TARGET_STATE,
	HELD_FOR_REVIEW_CAUSE,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { DeliveryInstanceRow, DeliveryRow } from "../types/delivery-monitoring.types"
import { deliveryInstanceViewOf, deliveryTargetViewOf, deliveryViewsOf } from "../utils/delivery-view"
import {
	ACQUISITION_CLOSED_AT,
	ACQUISITION_ID,
	ADMINISTRATOR,
	DELIVERY_ID,
	INSTANCE_ID,
	PACS,
} from "./delivery-monitoring-fixtures"

const OTHER_DELIVERY_ID = "23232323-2323-4323-8323-232323232323"
const CLOSED_AT = new Date("2026-11-09T10:15:30.250Z")
const ANCHOR = new Date("2026-11-09T10:16:02.000Z")
const CLINICAL_SAFETY = "clinical_safety"

const DELIVERY: DeliveryRow = {
	id: DELIVERY_ID,
	acquisition_id: ACQUISITION_ID,
	acquisition_kind: ACQUISITION_KIND.PHOTO,
	acquisition_closed_at: new Date(ACQUISITION_CLOSED_AT),
	target: PACS,
	state: DELIVERY_STATE.ASSEMBLED,
	reason: null,
}

const CONFIRMED: DeliveryInstanceRow = {
	id: INSTANCE_ID,
	delivery_id: DELIVERY_ID,
	artifact_id: "55555555-5555-4555-8555-555555555555",
	state: DELIVERY_INSTANCE_STATE.CONFIRMED,
	attempts: 1,
	last_dimse_status: "B000",
	accepted_transfer_syntax: "1.2.840.10008.1.2.4.50",
	retention_anchor: ANCHOR,
	held_for_review_cause: null,
	verification_rejections: 0,
	verification_on_hold_at: null,
	closed_from_state: null,
	closed_at: null,
	closed_by_user_id: null,
	closure_reason: null,
}

const HELD: DeliveryInstanceRow = {
	...CONFIRMED,
	id: "34343434-3434-4434-8434-343434343434",
	state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	last_dimse_status: "C002",
	accepted_transfer_syntax: null,
	retention_anchor: null,
	held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
}

const CLOSED: DeliveryInstanceRow = {
	...HELD,
	state: DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR,
	closed_from_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	closed_at: CLOSED_AT,
	closed_by_user_id: ADMINISTRATOR.userId,
	closure_reason: DELIVERY_CLOSURE_REASON.WRONG_PATIENT_OR_ENCOUNTER,
}

describe("the delivery the administration reads ✓ administration.yaml Delivery, DeliveryInstance", () => {
	it("NAB-345 hands over a confirmed instance with its anchor and the warning status as it came", () => {
		expect(deliveryInstanceViewOf(CONFIRMED)).toEqual({
			instance_id: INSTANCE_ID,
			artifact_id: CONFIRMED.artifact_id,
			state: DELIVERY_INSTANCE_STATE.CONFIRMED,
			attempts: 1,
			last_dimse_status: "B000",
			accepted_transfer_syntax: "1.2.840.10008.1.2.4.50",
			retention_anchor: ANCHOR.toISOString(),
			is_retryable: false,
			held_for_review_cause: null,
			verification_rejections: 0,
			verification_on_hold_at: null,
			closure: null,
		})
	})

	it("CAP-023-S27 hands over a held instance under the neutral name with its cause", () => {
		const view = deliveryInstanceViewOf(HELD)

		expect(view).toMatchObject({
			state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
			held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
			last_dimse_status: "C002",
			is_retryable: false,
		})
		expect(JSON.stringify(view)).not.toContain(CLINICAL_SAFETY)
	})

	it("CAP-023-R28 hands over the closure, keeps the cause of the hold and reports no deleted data", () => {
		expect(deliveryInstanceViewOf(CLOSED)).toMatchObject({
			state: DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR,
			is_retryable: false,
			retention_anchor: null,
			held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
			closure: {
				reason: DELIVERY_CLOSURE_REASON.WRONG_PATIENT_OR_ENCOUNTER,
				closed_from_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
				closed_at: CLOSED_AT.toISOString(),
				closed_by_user_id: ADMINISTRATOR.userId,
				set_aside_data_deleted_at: null,
			},
		})
	})

	it("NAB-345 nests each instance under its own delivery in the order read", () => {
		const other: DeliveryRow = { ...DELIVERY, id: OTHER_DELIVERY_ID }
		const foreign = { ...CONFIRMED, id: "35353535-3535-4535-8535-353535353535", delivery_id: OTHER_DELIVERY_ID }

		const views = deliveryViewsOf([DELIVERY, other], [CONFIRMED, foreign, HELD])

		expect(views.map((view) => view.instance.map((instance) => instance.instance_id))).toEqual([
			[CONFIRMED.id, HELD.id],
			[foreign.id],
		])
	})

	it("NAB-345 names the record by its kind and closing time, without patient data", () => {
		const [view] = deliveryViewsOf([DELIVERY], [])

		expect(view).toMatchObject({
			acquisition_id: ACQUISITION_ID,
			acquisition_kind: ACQUISITION_KIND.PHOTO,
			acquisition_closed_at: ACQUISITION_CLOSED_AT,
		})
	})

	it("CAP-023-R23 hands over a paused target with the rule that paused it", () => {
		const changedAt = new Date("2026-11-09T09:00:00.000Z")

		expect(
			deliveryTargetViewOf({
				code: PACS,
				state: DELIVERY_TARGET_STATE.PAUSED,
				reason: "STORE.A705",
				changed_at: changedAt,
			}),
		).toEqual({
			code: PACS,
			state: DELIVERY_TARGET_STATE.PAUSED,
			reason: "STORE.A705",
			changed_at: changedAt.toISOString(),
		})
	})
})
