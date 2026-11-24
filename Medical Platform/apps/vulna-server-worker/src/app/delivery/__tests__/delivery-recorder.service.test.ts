import { ADMINISTRATOR_ALERT_KIND, DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, type HeldQueueLease } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { DatabaseService } from "../../../libs/database/database.service"
import { TARGET_CHANGE, TASK_ACTION } from "../constants/delivery.constants"
import type { DeliveryAlertRepository } from "../repositories/delivery-alert.repository"
import type { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import type { DeliveryTargetRepository } from "../repositories/delivery-target.repository"
import { DeliveryRecorderService } from "../services/delivery-recorder.service"
import type { ClaimedDeliveryTask, DeliveryStep } from "../types/delivery.types"
import { instanceOf, SENDING_INSTANCE, stored } from "./delivery-fixtures"

const { WAITING, SENDING, CONFIRMED, PENDING_VERIFICATION } = DELIVERY_INSTANCE_STATE
const TASK: ClaimedDeliveryTask = {
	id: "55555555-5555-4555-8555-555555555555",
	objectKind: "delivery_instance",
	objectId: SENDING_INSTANCE.id,
	attempts: 0,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}
const LEASE: HeldQueueLease = { lockedBy: "worker-run", signal: new AbortController().signal }
const ALERT_ID = "66666666-6666-4666-8666-666666666666"
const RETRY_MILLISECONDS = 60_000

interface Harness {
	isHeld?: boolean
	isTargetActive?: boolean
	isMarked?: boolean
	isTransitioned?: boolean
	isTargetChanged?: boolean
}

function harness(options: Harness = {}) {
	const calls: string[] = []
	const audited: SystemJobAuditEvent[] = []
	const database = {
		sql: { begin: async <T>(work: (tx: object) => Promise<T>) => await work({}) },
	} as unknown as DatabaseService
	const queue = {
		isHeld: async () => options.isHeld ?? true,
		complete: async () => void calls.push("complete"),
		fail: async () => void calls.push("fail"),
		retryLaterWithin: async (_tx: object, _id: string, delay: number) => void calls.push(`retry ${delay}`),
	}
	const instances = {
		queue,
		markSending: async () => {
			calls.push("mark sending")
			return options.isMarked ?? true
		},
		transition: async () => {
			calls.push("transition")
			return options.isTransitioned ?? true
		},
		lockRecord: async () => void calls.push("lock record"),
		refreshAcquisitionState: async () => void calls.push("refresh state"),
		requestClinicalRecordWrites: async () => {
			calls.push("request writes")
			return true
		},
	} as unknown as DeliveryInstanceRepository
	const targets = {
		isActive: async () => options.isTargetActive ?? true,
		markUnavailable: async () => {
			calls.push("target unavailable")
			return options.isTargetChanged ?? true
		},
		pause: async () => {
			calls.push("target paused")
			return options.isTargetChanged ?? true
		},
	} as unknown as DeliveryTargetRepository
	const alerts = {
		resolveForTarget: async (_tx: object, kind: string) => void calls.push(`resolve ${kind}`),
		raiseForTarget: async (_tx: object, kind: string) => {
			calls.push(`raise ${kind}`)
			return ALERT_ID
		},
		raiseForInstance: async (_tx: object, kind: string) => {
			calls.push(`raise ${kind}`)
			return ALERT_ID
		},
	} as unknown as DeliveryAlertRepository
	const audit = {
		appendSystemJob: async (_tx: object, event: SystemJobAuditEvent) => {
			calls.push("audit")
			audited.push(event)
		},
	} as unknown as AuditRepository
	const recorder = new DeliveryRecorderService(database, instances, targets, alerts, audit)
	return { recorder, calls, audited }
}

function stepTo(to: (typeof DELIVERY_INSTANCE_STATE)[keyof typeof DELIVERY_INSTANCE_STATE]): DeliveryStep {
	return {
		transition: {
			from: SENDING,
			to,
			countedAttempts: 1,
			statusHex: "0000",
			acceptedTransferSyntax: undefined,
			heldForReviewCause: undefined,
			verificationRejections: 0,
			isOnHold: false,
		},
		target: undefined,
		alert: undefined,
		task: { kind: TASK_ACTION.COMPLETE },
		events: [
			{
				eventType: AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT,
				systemJob: "delivery",
				objectId: SENDING_INSTANCE.id,
				outcome: "success",
				details: {},
			},
		],
	}
}

describe("recording a delivery result ✓ dorucovaci-jadro.md 5, datovy-model.md 4 „Úloha fronty“", () => {
	it("CAP-023-R25 writes nothing once another worker holds the task", async () => {
		const run = harness({ isHeld: false })

		await run.recorder.record(TASK, SENDING_INSTANCE, stepTo(CONFIRMED), LEASE)
		await run.recorder.postpone(TASK, LEASE, RETRY_MILLISECONDS)

		expect(run.calls).toEqual([])
	})

	it("CAP-021-R28 settles the record, then writes the target, the alerts and the audit, and the task last", async () => {
		const run = harness()

		await run.recorder.record(TASK, SENDING_INSTANCE, stepTo(CONFIRMED), LEASE)

		expect(run.calls).toEqual(["transition", "lock record", "refresh state", "request writes", "audit", "complete"])
	})

	it("CAP-021-R28 asks for no clinical record writes while the instance is still on its way", async () => {
		const run = harness()

		await run.recorder.record(TASK, SENDING_INSTANCE, stepTo(PENDING_VERIFICATION), LEASE)

		expect(run.calls).not.toContain("request writes")
	})

	it("refuses a result for an instance that left its state under the lease", async () => {
		const run = harness({ isTransitioned: false })

		await expect(run.recorder.record(TASK, SENDING_INSTANCE, stepTo(CONFIRMED), LEASE)).rejects.toThrow(
			/left the state sending/,
		)
	})

	it("CAP-023-R23 pauses the target, ends its unavailability alert and audits the cause before the pause", async () => {
		const run = harness()
		const outcome = stored("A706")
		const step = { ...stepTo(WAITING), target: { kind: TARGET_CHANGE.PAUSED, exchange: outcome } }

		await run.recorder.record(TASK, SENDING_INSTANCE, step, LEASE)

		expect(run.calls).toEqual([
			"transition",
			"lock record",
			"refresh state",
			"target paused",
			`resolve ${ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY}`,
			`raise ${ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED}`,
			"audit",
			"audit",
			"audit",
			"complete",
		])
		expect(run.audited.map((event) => event.eventType)).toEqual([
			AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT,
			AUDIT_EVENT_TYPE.TARGET_PAUSED,
			AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		])
	})

	it("CAP-023-R24 audits nothing for a target that was already unavailable", async () => {
		const run = harness({ isTargetChanged: false })
		const step = { ...stepTo(WAITING), target: { kind: TARGET_CHANGE.UNAVAILABLE, exchange: stored(undefined) } }

		await run.recorder.record(TASK, SENDING_INSTANCE, step, LEASE)

		expect(run.audited.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT])
	})
})

describe("before an association opens ✓ CAP-023-R25, datovy-model.md 4 „Cíl doručení“", () => {
	it("marks the instance sending only behind an active target", async () => {
		const run = harness()

		expect(await run.recorder.markSending(TASK, instanceOf(WAITING), LEASE)).toBe(true)
		expect(run.calls).toEqual(["mark sending"])
	})

	it("puts the task back at once and sends nothing behind a target that is no longer active", async () => {
		const run = harness({ isTargetActive: false })

		expect(await run.recorder.markSending(TASK, instanceOf(WAITING), LEASE)).toBe(false)
		expect(await run.recorder.mayVerify(TASK, instanceOf(PENDING_VERIFICATION), LEASE)).toBe(false)
		expect(run.calls).toEqual(["retry 0", "retry 0"])
	})

	it("refuses to send an instance that left its state under the lease", async () => {
		const run = harness({ isMarked: false })

		await expect(run.recorder.markSending(TASK, instanceOf(WAITING), LEASE)).rejects.toThrow(/left the state waiting/)
	})

	it("postpones a task it still holds", async () => {
		const run = harness()

		await run.recorder.postpone(TASK, LEASE, RETRY_MILLISECONDS)

		expect(run.calls).toEqual([`retry ${RETRY_MILLISECONDS}`])
	})
})
