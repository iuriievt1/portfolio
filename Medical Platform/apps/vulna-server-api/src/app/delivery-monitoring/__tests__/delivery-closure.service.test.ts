import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_INSTANCE_STATES,
	type DeliveryInstanceState,
	isClosableDeliveryInstanceState,
} from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { fakeDatabase, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import { DeliveryClosureService } from "../services/delivery-closure.service"
import type { DeliveryOverviewService } from "../services/delivery-overview.service"
import type { InstanceClosure, LockedInstance } from "../types/delivery-monitoring.types"
import { ACQUISITION_ID, ADMINISTRATOR, DELIVERY, DELIVERY_ID, INSTANCE_ID } from "./delivery-monitoring-fixtures"

const NOTE = "Snímek pořízen znovu 9. 11."
const { HELD_FOR_REVIEW, PERMANENTLY_FAILED } = DELIVERY_INSTANCE_STATE
const NOT_CLOSABLE_STATES = DELIVERY_INSTANCE_STATES.filter((state) => !isClosableDeliveryInstanceState(state))

function harness(instance: LockedInstance | undefined) {
	const steps: string[] = []
	const audits: NewAuditEvent[] = []
	const deliveries = {
		lockedInstance: async () => instance,
		close: async (_tx: never, closure: InstanceClosure) =>
			void steps.push(`close ${closure.instanceId} from ${closure.from} for ${closure.reason}`),
		lockRecord: async (_tx: never, acquisitionId: string) => void steps.push(`lock ${acquisitionId}`),
		refreshAcquisitionState: async (_tx: never, acquisitionId: string) => void steps.push(`refresh ${acquisitionId}`),
	} as unknown as MonitoredDeliveryRepository
	const overview = {
		detailWithin: async (_tx: never, deliveryId: string) => {
			steps.push(`read ${deliveryId}`)
			return DELIVERY
		},
	} as unknown as DeliveryOverviewService
	const alerts = {
		resolveForInstance: async (_tx: never, kind: string, id: string) => void steps.push(`resolve ${kind} of ${id}`),
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			steps.push(`audit ${event.eventType}`)
			audits.push(event)
		},
	} as unknown as AuditRepository
	return { service: new DeliveryClosureService(fakeDatabase(), deliveries, overview, alerts, audit), steps, audits }
}

function locked(state: DeliveryInstanceState): LockedInstance {
	return { state, acquisition_id: ACQUISITION_ID }
}

describe("closing a delivery instance by the administrator ✓ CAP-023-R28, administration.yaml closeDeliveryInstance", () => {
	it("CAP-023-S24 closes a held instance, settles the record under its lock, ends the alert, audits and reads the result", async () => {
		const run = harness(locked(HELD_FOR_REVIEW))

		const delivery = await run.service.close(
			DELIVERY_ID,
			INSTANCE_ID,
			{ reason: DELIVERY_CLOSURE_REASON.DOCUMENTATION_REACQUIRED, note: NOTE },
			ADMINISTRATOR,
		)

		expect(delivery).toBe(DELIVERY)
		expect(run.steps).toEqual([
			`close ${INSTANCE_ID} from ${HELD_FOR_REVIEW} for ${DELIVERY_CLOSURE_REASON.DOCUMENTATION_REACQUIRED}`,
			`lock ${ACQUISITION_ID}`,
			`refresh ${ACQUISITION_ID}`,
			`resolve ${ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW} of ${INSTANCE_ID}`,
			`audit ${AUDIT_EVENT_TYPE.DELIVERY_CLOSED}`,
			`read ${DELIVERY_ID}`,
		])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.DELIVERY_CLOSED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: INSTANCE_ID,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					acquisition_id: ACQUISITION_ID,
					delivery_id: DELIVERY_ID,
					delivery_instance_id: INSTANCE_ID,
					closed_from_state: HELD_FOR_REVIEW,
					reason: DELIVERY_CLOSURE_REASON.DOCUMENTATION_REACQUIRED,
					note: NOTE,
					administrator_user_id: ADMINISTRATOR.userId,
				},
			},
		])
	})

	it("CAP-023-R17 ends the alert of a permanent failure when the failed instance is closed", async () => {
		const run = harness(locked(PERMANENTLY_FAILED))

		await run.service.close(
			DELIVERY_ID,
			INSTANCE_ID,
			{ reason: DELIVERY_CLOSURE_REASON.NOT_REQUIRED, note: undefined },
			ADMINISTRATOR,
		)

		expect(run.steps).toContain(`resolve ${ADMINISTRATOR_ALERT_KIND.PERMANENT_DELIVERY_FAILURE} of ${INSTANCE_ID}`)
		expect(run.audits[0]?.details).toMatchObject({ closed_from_state: PERMANENTLY_FAILED, note: null })
	})

	it.each(NOT_CLOSABLE_STATES)("CAP-023-R28 refuses to close an instance in %s and writes nothing", async (state) => {
		const run = harness(locked(state))

		const problem = await problemOf(
			run.service.close(
				DELIVERY_ID,
				INSTANCE_ID,
				{ reason: DELIVERY_CLOSURE_REASON.NOT_REQUIRED, note: undefined },
				ADMINISTRATOR,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.DELIVERY_NOT_CLOSABLE)
		expect(run.steps).toEqual([])
	})

	it("answers not found for an instance outside the delivery and writes nothing", async () => {
		const run = harness(undefined)

		const problem = await problemOf(
			run.service.close(
				DELIVERY_ID,
				INSTANCE_ID,
				{ reason: DELIVERY_CLOSURE_REASON.NOT_REQUIRED, note: undefined },
				ADMINISTRATOR,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(run.steps).toEqual([])
	})
})
