import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	DELIVERY_TARGET,
	DELIVERY_TARGET_STATE,
	type DeliveryTargetState,
} from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, PERMISSIONS } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import { DeliveryTargetResumptionService } from "../services/delivery-target-resumption.service"
import { DeliveryVerificationResumptionService } from "../services/delivery-verification-resumption.service"
import type { LockedTarget, LockedVerification } from "../types/delivery-monitoring.types"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}
const DELIVERY_ID = "22222222-2222-4222-8222-222222222222"
const INSTANCE_ID = "33333333-3333-4333-8333-333333333333"
const PACS = DELIVERY_TARGET.PACS
const REJECTIONS = 3

interface HarnessOptions {
	target?: LockedTarget | undefined
	verification?: LockedVerification | undefined
}

function harness(options: HarnessOptions) {
	const steps: string[] = []
	const audits: NewAuditEvent[] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const deliveries = {
		lockedTarget: async () => options.target,
		resumeTarget: async (_tx: never, code: string, userId: string) => void steps.push(`resume ${code} by ${userId}`),
		lockedVerification: async () => options.verification,
		resumeVerification: async (_tx: never, instanceId: string) => void steps.push(`resume verification ${instanceId}`),
	} as unknown as MonitoredDeliveryRepository
	const alerts = {
		resolveForTarget: async (_tx: never, kind: string, code: string) => void steps.push(`resolve ${kind} of ${code}`),
		resolveForInstance: async (_tx: never, kind: string, id: string) => void steps.push(`resolve ${kind} of ${id}`),
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => void audits.push(event),
	} as unknown as AuditRepository
	return {
		targets: new DeliveryTargetResumptionService(database, deliveries, alerts, audit),
		verifications: new DeliveryVerificationResumptionService(database, deliveries, alerts, audit),
		steps,
		audits,
	}
}

function target(state: DeliveryTargetState): LockedTarget {
	return { state, reason: state === DELIVERY_TARGET_STATE.ACTIVE ? null : "STORE.A705" }
}

describe("resuming a paused delivery target ✓ CAP-023-R23, administration.yaml resumeDeliveryTarget", () => {
	it("CAP-023-S10 resumes a paused target, ends its alert and audits the administrator", async () => {
		const run = harness({ target: target(DELIVERY_TARGET_STATE.PAUSED) })

		await run.targets.resume(PACS, ADMINISTRATOR)

		expect(run.steps).toEqual([
			`resume ${PACS} by ${ADMINISTRATOR.userId}`,
			`resolve ${ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED} of ${PACS}`,
		])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.TARGET_RESUMED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: expect.objectContaining({ target_code: PACS, reason: "STORE.A705" }),
			}),
		])
	})

	it.each([DELIVERY_TARGET_STATE.ACTIVE, DELIVERY_TARGET_STATE.UNAVAILABLE])(
		"CAP-023-R24 refuses to resume a target that is %s with target-not-paused",
		async (state) => {
			const run = harness({ target: target(state) })

			const problem = await problemOf(run.targets.resume(PACS, ADMINISTRATOR))

			expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
			expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.TARGET_NOT_PAUSED)
			expect(run.steps).toEqual([])
			expect(run.audits).toEqual([])
		},
	)

	it("answers not-found for an unknown target", async () => {
		const run = harness({ target: undefined })

		const problem = await problemOf(run.targets.resume("archive", ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})

describe("resuming a verification on hold ✓ CAP-023-R26, administration.yaml resumeDeliveryVerification", () => {
	it("CAP-023-S18 resumes the verification, ends its alert and audits the administrator", async () => {
		const run = harness({ verification: { verification_on_hold_at: new Date(), verification_rejections: REJECTIONS } })

		await run.verifications.resume(DELIVERY_ID, INSTANCE_ID, ADMINISTRATOR)

		expect(run.steps).toEqual([
			`resume verification ${INSTANCE_ID}`,
			`resolve ${ADMINISTRATOR_ALERT_KIND.VERIFICATION_REJECTED} of ${INSTANCE_ID}`,
		])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.VERIFICATION_RESUMED,
				actorUserId: ADMINISTRATOR.userId,
				objectId: INSTANCE_ID,
				details: expect.objectContaining({ delivery_id: DELIVERY_ID, rejections_in_a_row: REJECTIONS }),
			}),
		])
	})

	it("refuses a verification that is not on hold with verification-not-on-hold", async () => {
		const run = harness({ verification: { verification_on_hold_at: null, verification_rejections: 1 } })

		const problem = await problemOf(run.verifications.resume(DELIVERY_ID, INSTANCE_ID, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.VERIFICATION_NOT_ON_HOLD)
		expect(run.steps).toEqual([])
	})

	it("answers not-found for an instance outside the delivery", async () => {
		const run = harness({ verification: undefined })

		const problem = await problemOf(run.verifications.resume(DELIVERY_ID, INSTANCE_ID, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})
