import {
	ACQUISITION_KIND,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	DELIVERY_TARGET,
	HELD_FOR_REVIEW_CAUSE,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { NOTICE_TONE } from "@/components/custom/notice"
import {
	INSTANCE_NOTICE_KIND,
	instanceCountsOf,
	instanceCountText,
	instanceDisplayOf,
	instanceNoticeOf,
	recordText,
} from "@/features/deliveries/lib/delivery-text"
import type { Delivery, DeliveryInstance } from "@/features/deliveries/types/delivery.types"
import { formatDateTime } from "@/lib/format"

const CLOSED_AT = "2026-11-09T10:12:00.000Z"

const CONFIRMED: DeliveryInstance = {
	instance_id: "33333333-3333-4333-8333-333333333333",
	artifact_id: "55555555-5555-4555-8555-555555555555",
	state: DELIVERY_INSTANCE_STATE.CONFIRMED,
	attempts: 1,
	last_dimse_status: "0000",
	accepted_transfer_syntax: "1.2.840.10008.1.2.4.50",
	retention_anchor: "2026-11-09T10:16:02.000Z",
	is_retryable: false,
	held_for_review_cause: null,
	verification_rejections: 0,
	verification_on_hold_at: null,
	closure: null,
}

const WARNED: DeliveryInstance = { ...CONFIRMED, last_dimse_status: "B000" }

const HELD: DeliveryInstance = {
	...CONFIRMED,
	state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	last_dimse_status: "C002",
	retention_anchor: null,
	held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
}

const ON_HOLD: DeliveryInstance = {
	...CONFIRMED,
	state: DELIVERY_INSTANCE_STATE.PENDING_VERIFICATION,
	retention_anchor: null,
	verification_rejections: 3,
	verification_on_hold_at: "2026-11-09T10:20:00.000Z",
}

const DELIVERY: Delivery = {
	delivery_id: "22222222-2222-4222-8222-222222222222",
	acquisition_id: "44444444-4444-4444-8444-444444444444",
	acquisition_kind: ACQUISITION_KIND.PHOTO,
	acquisition_closed_at: CLOSED_AT,
	target: DELIVERY_TARGET.PACS,
	state: DELIVERY_STATE.ASSEMBLED,
	reason: null,
	instance: [CONFIRMED, HELD, WARNED, CONFIRMED],
}

describe("how a delivery names its record ✓ NAB-345", () => {
	it("names the record by its kind and closing time, not by its identifier", () => {
		expect(recordText(DELIVERY)).toBe(`Rána · ${formatDateTime(CLOSED_AT)}`)
		expect(recordText({ ...DELIVERY, acquisition_kind: ACQUISITION_KIND.SCAN })).toMatch(/^Dokument · /)
	})
})

describe("how an instance looks to the administrator ✓ stavy-a-mikrocopy.md 3.3", () => {
	it("CAP-023-R12 tells a store with a warning apart from a plain store", () => {
		expect(instanceDisplayOf(CONFIRMED).label).toBe("Uloženo v PACS")
		expect(instanceDisplayOf(WARNED).label).toBe("Uloženo v PACS s varováním")
	})

	it("CAP-023-R26 tells a verification waiting for the administrator apart from one still running", () => {
		expect(instanceDisplayOf(ON_HOLD).label).toBe("Ověřování čeká na zásah správce")
		expect(instanceDisplayOf({ ...ON_HOLD, verification_on_hold_at: null }).label).toBe("Ověřuje se v PACS")
	})

	it("NAB-345 counts the instances of a delivery by what the administrator sees, in the order of the states", () => {
		expect(instanceCountsOf(DELIVERY).map(instanceCountText)).toEqual([
			"2× Uloženo v PACS",
			"1× Uloženo v PACS s varováním",
			"1× Čeká na posouzení",
		])
		expect(instanceCountsOf({ ...DELIVERY, instance: [] })).toEqual([])
	})
})

describe("what the administrator reads about an instance ✓ stavy-a-mikrocopy.md E63, E64, E65", () => {
	it("CAP-023-S21 explains a store with a warning under its title, but not a plain store", () => {
		expect(instanceNoticeOf(WARNED)).toEqual({
			kind: INSTANCE_NOTICE_KIND.EXPLANATION,
			tone: NOTICE_TONE.WARN,
			title: "Uloženo v PACS s varováním",
			text: expect.stringContaining("se stavem B000"),
		})
		expect(instanceNoticeOf(CONFIRMED)).toBeUndefined()
	})

	it("CAP-023-S02 explains the status the PACS refused the instance with", () => {
		expect(instanceNoticeOf(HELD)).toMatchObject({ tone: NOTICE_TONE.CRITICAL, text: expect.stringContaining("C002") })
	})

	it("CAP-023-S19, CAP-023-S20 explains a hash mismatch and an identity conflict", () => {
		const mismatch = { ...HELD, held_for_review_cause: HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH }
		const conflict = { ...HELD, held_for_review_cause: HELD_FOR_REVIEW_CAUSE.STUDY_IDENTITY_CONFLICT }

		expect(instanceNoticeOf(mismatch)).toMatchObject({ text: expect.stringContaining("Do PACS se nic neodeslalo") })
		expect(instanceNoticeOf(conflict)).toMatchObject({ text: expect.stringContaining("patří jinému pacientovi") })
	})

	it("CAP-023-R17 explains a permanent failure with the last status", () => {
		const failed = { ...HELD, state: DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED, last_dimse_status: "A700" }

		expect(instanceNoticeOf({ ...failed, held_for_review_cause: null })).toMatchObject({
			tone: NOTICE_TONE.CRITICAL,
			text: expect.stringContaining("A700"),
		})
	})

	it("CAP-023-S18 hands the verification waiting for the administrator to the resume action", () => {
		expect(instanceNoticeOf(ON_HOLD)).toEqual({
			kind: INSTANCE_NOTICE_KIND.VERIFICATION_ON_HOLD,
			text: expect.stringContaining("3× za sebou"),
		})
	})

	it("CAP-023-R28 keeps explaining why a closed instance was held, as a warning", () => {
		const closed: DeliveryInstance = {
			...HELD,
			state: DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR,
			closure: {
				reason: DELIVERY_CLOSURE_REASON.NOT_REQUIRED,
				closed_from_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
				closed_at: "2026-11-09T10:30:00.000Z",
				closed_by_user_id: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
				set_aside_data_deleted_at: null,
			},
		}

		expect(instanceNoticeOf(closed)).toMatchObject({ tone: NOTICE_TONE.WARN, text: expect.stringContaining("C002") })
	})
})
