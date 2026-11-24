import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	ASSEMBLY_FAILURE_REASON,
	DELIVERY_STATE,
	DELIVERY_STATES,
	type DeliveryState,
} from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AssemblyTaskRepository } from "../../acquisition/repositories/assembly-task.repository"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { fakeDatabase, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import type { DeliveryOverviewService } from "../services/delivery-overview.service"
import { TextRecognitionRestartService } from "../services/text-recognition-restart.service"
import type { LockedDelivery } from "../types/delivery-monitoring.types"
import { ACQUISITION_ID, ADMINISTRATOR, DELIVERY, DELIVERY_ID, RESTART_REASON } from "./delivery-monitoring-fixtures"

const OTHER_REASON = "clinical_record_missing"
const NOT_FAILED_STATES = DELIVERY_STATES.filter((state) => state !== DELIVERY_STATE.ASSEMBLY_FAILED)

function harness(delivery: LockedDelivery | undefined, hasFailedTask = true) {
	const steps: string[] = []
	const audits: NewAuditEvent[] = []
	const deliveries = {
		lockedDelivery: async () => delivery,
		restartAssembly: async (_tx: never, deliveryId: string) => void steps.push(`restart ${deliveryId}`),
		resetTextRecognition: async (_tx: never, acquisitionId: string) => void steps.push(`reset ${acquisitionId}`),
		reviveAssemblyTask: async (_tx: never, acquisitionId: string) => {
			steps.push(`revive ${acquisitionId}`)
			return hasFailedTask
		},
		lockRecord: async (_tx: never, acquisitionId: string) => void steps.push(`lock ${acquisitionId}`),
		refreshAcquisitionState: async (_tx: never, acquisitionId: string) => void steps.push(`refresh ${acquisitionId}`),
	} as unknown as MonitoredDeliveryRepository
	const assemblies = {
		enqueue: async (_tx: never, acquisitionId: string) => void steps.push(`enqueue ${acquisitionId}`),
	} as unknown as AssemblyTaskRepository
	const overview = {
		detailWithin: async (_tx: never, deliveryId: string) => {
			steps.push(`read ${deliveryId}`)
			return DELIVERY
		},
	} as unknown as DeliveryOverviewService
	const alerts = {
		resolveForDelivery: async (_tx: never, kind: string, id: string) => void steps.push(`resolve ${kind} of ${id}`),
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			steps.push(`audit ${event.eventType}`)
			audits.push(event)
		},
	} as unknown as AuditRepository
	return {
		service: new TextRecognitionRestartService(fakeDatabase(), deliveries, assemblies, overview, alerts, audit),
		steps,
		audits,
	}
}

function locked(state: DeliveryState, reason: string | null): LockedDelivery {
	return { state, reason, acquisition_id: ACQUISITION_ID }
}

const FAILED_RECOGNITION = locked(DELIVERY_STATE.ASSEMBLY_FAILED, ASSEMBLY_FAILURE_REASON.OCR_FAILED)

describe("restarting the text recognition ✓ CAP-022-R15, administration.yaml restartTextRecognition", () => {
	it("CAP-022-S06 sends the document back to the assembly with a fresh count, ends the alert, audits and reads the result", async () => {
		const run = harness(FAILED_RECOGNITION)

		const delivery = await run.service.restart(DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR)

		expect(delivery).toBe(DELIVERY)
		expect(run.steps).toEqual([
			`restart ${DELIVERY_ID}`,
			`reset ${ACQUISITION_ID}`,
			`revive ${ACQUISITION_ID}`,
			`lock ${ACQUISITION_ID}`,
			`refresh ${ACQUISITION_ID}`,
			`resolve ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED} of ${DELIVERY_ID}`,
			`audit ${AUDIT_EVENT_TYPE.TEXT_RECOGNITION_RESTARTED}`,
			`read ${DELIVERY_ID}`,
		])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.TEXT_RECOGNITION_RESTARTED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: DELIVERY_ID,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					acquisition_id: ACQUISITION_ID,
					delivery_id: DELIVERY_ID,
					reason: RESTART_REASON,
					administrator_user_id: ADMINISTRATOR.userId,
				},
			},
		])
	})

	it("queues a new assembly when no failed assembly task is left to revive", async () => {
		const run = harness(FAILED_RECOGNITION, false)

		await run.service.restart(DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR)

		expect(run.steps.slice(2, 4)).toEqual([`revive ${ACQUISITION_ID}`, `enqueue ${ACQUISITION_ID}`])
	})

	it("refuses a delivery that does not exist and writes nothing", async () => {
		const run = harness(undefined)

		const problem = await problemOf(run.service.restart(DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR))

		expect(problem).toMatchObject({ status: HttpStatus.NOT_FOUND, code: ADMINISTRATION_ERROR_CODE.NOT_FOUND })
		expect(run.steps).toEqual([])
	})

	it("CAP-022-R15 refuses an assembly that failed for another reason than the text recognition (negative)", async () => {
		const run = harness(locked(DELIVERY_STATE.ASSEMBLY_FAILED, OTHER_REASON))

		const problem = await problemOf(run.service.restart(DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR))

		expect(problem).toMatchObject({
			status: HttpStatus.CONFLICT,
			code: ADMINISTRATION_ERROR_CODE.TEXT_RECOGNITION_NOT_FAILED,
		})
		expect(run.steps).toEqual([])
	})

	it.each(NOT_FAILED_STATES)("CAP-022-R15 refuses a delivery in %s and writes nothing (negative)", async (state) => {
		const run = harness(locked(state, null))

		const problem = await problemOf(run.service.restart(DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR))

		expect(problem).toMatchObject({
			status: HttpStatus.CONFLICT,
			code: ADMINISTRATION_ERROR_CODE.TEXT_RECOGNITION_NOT_FAILED,
		})
		expect(run.steps).toEqual([])
	})
})
