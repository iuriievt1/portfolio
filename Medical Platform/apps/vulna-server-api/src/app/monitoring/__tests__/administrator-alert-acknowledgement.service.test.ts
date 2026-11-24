import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import {
	ADMINISTRATOR,
	ALERT_ID,
	DELIVERY_ID,
	INSTANCE_ID,
} from "../../delivery-monitoring/__tests__/delivery-monitoring-fixtures"
import { fakeDatabase, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import { AdministratorAlertAcknowledgementService } from "../services/administrator-alert-acknowledgement.service"
import type { LockedAlert } from "../types/monitoring.types"

const STORED_WITH_WARNING: LockedAlert = {
	kind: ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
	resolved_at: null,
	delivery_id: DELIVERY_ID,
	delivery_instance_id: INSTANCE_ID,
}

function harness(alert: LockedAlert | undefined) {
	const acknowledged: string[] = []
	const audits: NewAuditEvent[] = []
	const alerts = {
		locked: async () => alert,
		acknowledge: async (_tx: never, alertId: string, userId: string) =>
			void acknowledged.push(`${alertId} by ${userId}`),
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => void audits.push(event),
	} as unknown as AuditRepository
	return { service: new AdministratorAlertAcknowledgementService(fakeDatabase(), alerts, audit), acknowledged, audits }
}

describe("acknowledging a warning of a stored instance ✓ CAP-023-R12, administration.yaml acknowledgeAdministratorAlert", () => {
	it("CAP-023-S28 takes the warning out of the active alerts and audits the administrator", async () => {
		const run = harness(STORED_WITH_WARNING)

		await run.service.acknowledge(ALERT_ID, ADMINISTRATOR)

		expect(run.acknowledged).toEqual([`${ALERT_ID} by ${ADMINISTRATOR.userId}`])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_ACKNOWLEDGED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: ALERT_ID,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					alert_id: ALERT_ID,
					kind: ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
					delivery_id: DELIVERY_ID,
					delivery_instance_id: INSTANCE_ID,
					administrator_user_id: ADMINISTRATOR.userId,
				},
			},
		])
	})

	it.each([
		[
			"another kind, whose cause still lasts",
			{ ...STORED_WITH_WARNING, kind: ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW },
		],
		["a warning acknowledged before", { ...STORED_WITH_WARNING, resolved_at: new Date("2026-11-09T10:00:00Z") }],
	])("CAP-023-S29 refuses %s and writes nothing", async (_case, alert) => {
		const run = harness(alert)

		const problem = await problemOf(run.service.acknowledge(ALERT_ID, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.ALERT_NOT_ACKNOWLEDGEABLE)
		expect(run.acknowledged).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("answers not found for an unknown alert", async () => {
		const problem = await problemOf(harness(undefined).service.acknowledge(ALERT_ID, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})
