import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { STORE_OUTAGE_ALERT_SECONDS } from "../constants/monitoring.constants"
import type { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import { StoreOutageAlertService } from "../services/store-outage-alert.service"

const ALERT_ID = "88888888-8888-4888-8888-888888888888"
const STARTED_AT = Date.UTC(2026, 9, 27, 8, 0, 0)
const OUTAGE_LIMIT = STORE_OUTAGE_ALERT_SECONDS * MILLISECONDS_PER_SECOND

function harness(alreadyActive = false) {
	const dependencies = new DependencyStateService()
	const audited: NewAuditEvent[] = []
	const messages: string[] = []
	let isActive = alreadyActive
	let resolutions = 0
	const alerts = {
		raiseStoreUnavailable: async (_tx: never, message: string) => {
			if (isActive) {
				return undefined
			}
			isActive = true
			messages.push(message)
			return ALERT_ID
		},
		resolveStoreUnavailable: async () => {
			isActive = false
			resolutions += 1
		},
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const service = new StoreOutageAlertService(database, dependencies, alerts, audit)
	return {
		service,
		store: dependencies.clinicalRecordStore,
		audited,
		messages,
		isActive: () => isActive,
		resolutions: () => resolutions,
	}
}

describe("StoreOutageAlertService", () => {
	it("CAP-028-S09 waits while the outage is shorter than the limit", async () => {
		const { service, store, isActive } = harness()
		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT - MILLISECONDS_PER_SECOND)

		await service.evaluate()

		expect(isActive()).toBe(false)
	})

	it("CAP-028-S09 alerts the administrator once the store has failed for the whole limit", async () => {
		const { service, store, audited, messages, isActive } = harness()
		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT)

		await service.evaluate()
		await service.evaluate()

		expect(isActive()).toBe(true)
		expect(messages).toEqual([expect.stringContaining("Úložiště klinického záznamu neodpovídá od 27. 10. 2026")])
		expect(audited).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
				actorKind: AUDIT_ACTOR_KIND.SYSTEM_JOB,
				systemJob: SYSTEM_JOB.DEPENDENCY_MONITORING,
				objectId: ALERT_ID,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: {
					alert_id: ALERT_ID,
					alert_kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_STORE_UNAVAILABLE,
					message: messages[0],
					unavailable_since: new Date(STARTED_AT).toISOString(),
				},
			},
		])
	})

	it("CAP-028-R15 clears the alert with the first answer of the store", async () => {
		const { service, store, isActive, resolutions } = harness()
		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT)
		await service.evaluate()

		store.recordAnswer()
		await service.evaluate()
		await service.evaluate()

		expect(isActive()).toBe(false)
		expect(resolutions()).toBe(1)
	})

	it("CAP-028-R15 clears the alert when the store answered between two checks and failed again", async () => {
		const { service, store, isActive, resolutions } = harness()
		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT)
		await service.evaluate()
		store.recordAnswer()
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT + MILLISECONDS_PER_SECOND)

		await service.evaluate()

		expect(isActive()).toBe(false)
		expect(resolutions()).toBe(1)
	})

	it("clears an alert left active before the process started once the store answers", async () => {
		const { service, store, isActive } = harness(true)

		await service.evaluate()
		expect(isActive()).toBe(true)

		store.recordAnswer()
		await service.evaluate()

		expect(isActive()).toBe(false)
	})

	it("does not write a second alert event while an earlier alert is still active", async () => {
		const { service, store, audited } = harness(true)
		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + OUTAGE_LIMIT)

		await service.evaluate()

		expect(audited).toEqual([])
	})
})
