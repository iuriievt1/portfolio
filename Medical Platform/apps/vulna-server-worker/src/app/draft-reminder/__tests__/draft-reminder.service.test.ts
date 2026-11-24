import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { DraftReminderRepository } from "../repositories/draft-reminder.repository"
import type { StaleDraftsAlertRepository } from "../repositories/stale-drafts-alert.repository"
import { DraftReminderService } from "../services/draft-reminder.service"

const REMINDER_SECONDS = 30 * 86_400
const NOW = new Date("2026-10-16T12:00:00.000Z")
const ALERT_ID = "55555555-5555-4555-8555-555555555555"

interface HarnessOptions {
	staleCount: number
	remindedCount: number
	isAlertActive?: boolean
}

function harness(options: HarnessOptions) {
	const steps: string[] = []
	const audits: SystemJobAuditEvent[] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const configuration = {
		effectiveValues: async () => new Map([[CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS, REMINDER_SECONDS]]),
	} as unknown as ConfigurationService
	const reminders = {
		remindStaleDrafts: async (_tx: never, seconds: number) => {
			steps.push(`remind after ${seconds}`)
			return options.remindedCount
		},
		countStaleDrafts: async () => options.staleCount,
	} as unknown as DraftReminderRepository
	const alerts = {
		raise: async (_tx: never, message: string) => {
			steps.push(`raise ${message}`)
			return options.isAlertActive === true ? undefined : ALERT_ID
		},
		refresh: async (_tx: never, message: string) => {
			steps.push(`refresh ${message}`)
		},
		resolve: async () => {
			steps.push("resolve")
		},
	} as unknown as StaleDraftsAlertRepository
	const audit = {
		appendSystemJob: async (_tx: never, event: SystemJobAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	return { service: new DraftReminderService(database, configuration, reminders, alerts, audit), steps, audits }
}

describe("reminder of forgotten drafts CAP-026-R16, CAP-015-R18", () => {
	it("CAP-015-S43 reminds the operators and alerts the administrator with the number of stale drafts", async () => {
		const run = harness({ staleCount: 2, remindedCount: 1 })

		const result = await run.service.run(NOW)

		expect(result).toEqual({ remindedCount: 1, staleCount: 2 })
		expect(run.steps[0]).toBe(`remind after ${REMINDER_SECONDS}`)
		expect(run.steps[1]).toMatch(/^raise Rozpracovaných záznamů bez doplnění déle než 30 dnů: 2\./)
	})

	it("CAP-028-R15 records a new alert in the audit trail for Syslog", async () => {
		const run = harness({ staleCount: 2, remindedCount: 2 })

		await run.service.run(NOW)

		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
			systemJob: SYSTEM_JOB.DRAFT_REMINDER,
			objectId: ALERT_ID,
			outcome: AUDIT_OUTCOME.FAILURE,
			details: {
				alert_id: ALERT_ID,
				alert_kind: ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS,
				stale_draft_count: 2,
			},
		})
	})

	it("updates the count of an active alert without recording it again", async () => {
		const run = harness({ staleCount: 3, remindedCount: 1, isAlertActive: true })

		await run.service.run(NOW)

		expect(run.steps[2]).toMatch(/^refresh Rozpracovaných záznamů bez doplnění déle než 30 dnů: 3\./)
		expect(run.audits).toEqual([])
	})

	it("CAP-015-S42 clears the administrator alert once no draft is stale and deletes nothing", async () => {
		const run = harness({ staleCount: 0, remindedCount: 0 })

		await run.service.run(NOW)

		expect(run.steps).toEqual([`remind after ${REMINDER_SECONDS}`, "resolve"])
		expect(run.audits).toEqual([])
	})
})
