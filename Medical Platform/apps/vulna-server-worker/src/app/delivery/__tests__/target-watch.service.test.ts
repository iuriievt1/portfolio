import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ARCHIVE_OUTCOME_CLASS, ARCHIVE_PHASE, type ArchiveExchange } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { DeliveryAlertRepository } from "../repositories/delivery-alert.repository"
import type { DeliveryTargetRepository } from "../repositories/delivery-target.repository"
import { TargetWatchService } from "../services/target-watch.service"
import { classification, settingsWith } from "./delivery-fixtures"

const PACS = "pacs"
const ALERT_SECONDS = 3600
const OUTAGE_START = new Date("2026-11-09T08:00:00.000Z")

function echoOf(outcomeClass: ArchiveExchange["classification"]["outcomeClass"]): ArchiveExchange {
	return {
		phase: outcomeClass === ARCHIVE_OUTCOME_CLASS.SUCCESS ? ARCHIVE_PHASE.RESPONSE : ARCHIVE_PHASE.NOT_SENT,
		notSentReason: undefined,
		timeout: undefined,
		statusHex: undefined,
		errorComment: undefined,
		classification: classification({ outcomeClass, ruleId: "ECHO.0000" }),
	}
}

function harness(echo: ArchiveExchange, isOutageLong: boolean) {
	const calls: string[] = []
	const audited: SystemJobAuditEvent[] = []
	const signals: (AbortSignal | undefined)[] = []
	const database = {
		sql: { begin: async <T>(work: (tx: object) => Promise<T>) => await work({}) },
	} as unknown as DatabaseService
	const targets = {
		unavailable: async () => [{ code: PACS, changed_at: OUTAGE_START }],
		release: async () => {
			calls.push("release")
			return true
		},
		markUnavailabilityAlerted: async () => {
			calls.push("mark alerted")
			return isOutageLong ? { code: PACS, changed_at: OUTAGE_START } : undefined
		},
	} as unknown as DeliveryTargetRepository
	const alerts = {
		resolveForTarget: async (_tx: object, kind: string) => void calls.push(`resolve ${kind}`),
		raiseForTarget: async (_tx: object, kind: string) => {
			calls.push(`raise ${kind}`)
			return "alert-1"
		},
	} as unknown as DeliveryAlertRepository
	const audit = {
		appendSystemJob: async (_tx: object, event: SystemJobAuditEvent) => {
			calls.push("audit")
			audited.push(event)
		},
	} as unknown as AuditRepository
	const unused = async (): Promise<never> => {
		throw new Error("not expected")
	}
	const settings = {
		...settingsWith({
			checkAvailability: async (signal) => {
				signals.push(signal)
				return echo
			},
			storeImage: unused,
			storeDocument: unused,
			findInstance: unused,
			findStudyPatients: unused,
		}),
		unavailableAlertSeconds: ALERT_SECONDS,
	}
	const watcher = new TargetWatchService(database, targets, alerts, audit)
	return { watch: async () => await watcher.watch(settings), calls, audited, signals }
}

describe("watching an unavailable delivery target ✓ CAP-023-R24, CAP-023-R27", () => {
	it("CAP-023-S13 releases the target and ends its unavailability alert after a successful C-ECHO", async () => {
		const run = harness(echoOf(ARCHIVE_OUTCOME_CLASS.SUCCESS), false)

		await run.watch()

		expect(run.calls).toEqual(["release", `resolve ${ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY}`, "audit"])
		expect(run.audited[0]?.eventType).toBe(AUDIT_EVENT_TYPE.TARGET_RELEASED)
		expect(run.signals).toEqual([undefined])
	})

	it("CAP-023-S22 alerts once an outage lasts longer than the configured time", async () => {
		const run = harness(echoOf(ARCHIVE_OUTCOME_CLASS.TRANSIENT), true)

		await run.watch()

		expect(run.calls).toEqual([
			"mark alerted",
			`raise ${ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY}`,
			"audit",
			"audit",
		])
		expect(run.audited.map((event) => event.eventType)).toEqual([
			AUDIT_EVENT_TYPE.TARGET_UNAVAILABILITY_ALERT,
			AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		])
		expect(run.audited[0]?.details).toMatchObject({
			unavailable_since: OUTAGE_START.toISOString(),
			alert_seconds: ALERT_SECONDS,
		})
	})

	it("CAP-023-S23 stays silent during a short outage", async () => {
		const run = harness(echoOf(ARCHIVE_OUTCOME_CLASS.TRANSIENT), false)

		await run.watch()

		expect(run.calls).toEqual(["mark alerted"])
	})
})
