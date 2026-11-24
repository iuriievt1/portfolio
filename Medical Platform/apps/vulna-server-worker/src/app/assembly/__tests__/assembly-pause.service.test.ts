import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { DatabaseService } from "../../../libs/database/database.service"
import { ASSEMBLY_PAUSE } from "../constants/assembly.constants"
import type { AssemblyAlertRepository } from "../repositories/assembly-alert.repository"
import { AssemblyPauseService } from "../services/assembly-pause.service"
import { assemblyPauseMessageOf } from "../utils/assembly-alert"
import { ALERT_ID } from "./assembly-fixtures"

function pauseHarness(isAlertRaised = true) {
	const steps: string[] = []
	const audits: SystemJobAuditEvent[] = []
	const run = { failure: undefined as Error | undefined }
	const database = {
		sql: {
			begin: async (work: (tx: never) => Promise<unknown>) => {
				if (run.failure !== undefined) {
					throw run.failure
				}
				return await work({} as never)
			},
		},
	} as unknown as DatabaseService
	const alerts = {
		raisePause: async (_tx: never, message: string) => {
			steps.push(`raise ${message}`)
			return isAlertRaised ? ALERT_ID : undefined
		},
		resolvePause: async () => {
			steps.push("resolve")
		},
	} as unknown as AssemblyAlertRepository
	const audit = {
		appendSystemJob: async (_tx: never, event: SystemJobAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	return Object.assign(run, { pauses: new AssemblyPauseService(database, alerts, audit), steps, audits })
}

describe("pause of the assembly CAP-021-R41 CAP-028-R15", () => {
	it("raises the alert once for a cause and audits it as the assembly", async () => {
		const run = pauseHarness()
		const message = assemblyPauseMessageOf(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)

		await run.pauses.paused(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)
		await run.pauses.paused(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)

		expect(run.steps).toEqual([`raise ${message}`])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
				systemJob: SYSTEM_JOB.ASSEMBLY,
				objectId: ALERT_ID,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: {
					alert_id: ALERT_ID,
					alert_kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED,
					message,
					reason: ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING,
				},
			},
		])
	})

	it("raises the alert once when two lanes of one process pause at the same time", async () => {
		const run = pauseHarness()

		await Promise.all([
			run.pauses.paused(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING),
			run.pauses.paused(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING),
		])

		expect(run.steps).toEqual([`raise ${assemblyPauseMessageOf(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)}`])
	})

	it("raises the alert again after a failed attempt to raise it", async () => {
		const run = pauseHarness()
		run.failure = new Error("database down")

		await expect(run.pauses.paused(ASSEMBLY_PAUSE.RELEASE_UNFIT)).rejects.toThrow("database down")
		run.failure = undefined
		await run.pauses.paused(ASSEMBLY_PAUSE.RELEASE_UNFIT)

		expect(run.steps).toEqual([`raise ${assemblyPauseMessageOf(ASSEMBLY_PAUSE.RELEASE_UNFIT)}`])
	})

	it("raises the alert again when the cause changes", async () => {
		const run = pauseHarness()

		await run.pauses.paused(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)
		await run.pauses.paused(ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS)

		expect(run.steps).toEqual([
			`raise ${assemblyPauseMessageOf(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)}`,
			`raise ${assemblyPauseMessageOf(ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS)}`,
		])
	})

	it("audits nothing when another process already raised the same alert", async () => {
		const run = pauseHarness(false)

		await run.pauses.paused(ASSEMBLY_PAUSE.PATIENT_ID_SYSTEM_MISSING)

		expect(run.audits).toEqual([])
	})

	it("CAP-021-S38 resolves the alert once when the assembly runs, and raises it again on the next pause", async () => {
		const run = pauseHarness()

		await run.pauses.resumed()
		await run.pauses.resumed()
		await run.pauses.paused(ASSEMBLY_PAUSE.RELEASE_UNFIT)
		await run.pauses.resumed()

		expect(run.steps).toEqual(["resolve", `raise ${assemblyPauseMessageOf(ASSEMBLY_PAUSE.RELEASE_UNFIT)}`, "resolve"])
	})

	it("CAP-028-R15 names the cause for every pause in the alert", () => {
		for (const pause of Object.values(ASSEMBLY_PAUSE)) {
			const message = assemblyPauseMessageOf(pause)

			expect(message).toMatch(/^Sestavení záznamů pro PACS stojí: \S/)
			expect(message).not.toContain("undefined")
		}
	})
})
