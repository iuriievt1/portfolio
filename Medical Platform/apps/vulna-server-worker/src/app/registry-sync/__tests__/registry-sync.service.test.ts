import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, PATIENT_SEX, REGISTRY_SYNC_OUTCOME, SYSTEM_JOB } from "@ansora/contracts"
import {
	type DayInterval,
	type PatientGroup,
	type PatientIdentifier,
	type PatientRecord,
	REGISTRY_QUERY_OUTCOME,
	type RegistryQueryOutcome,
	type RegistrySourcePort,
	type ScheduledEncounter,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { DatabaseService } from "../../../libs/database/database.service"
import { UPSERT_OUTCOME } from "../constants/registry-sync.constants"
import type { RegistryCacheRepository } from "../repositories/registry-cache.repository"
import type { SyncLockRepository } from "../repositories/sync-lock.repository"
import type { SyncRunRepository } from "../repositories/sync-run.repository"
import { RegistrySyncService } from "../services/registry-sync.service"
import type { DocumentedPatient, RegistrySyncSettings, SyncRun } from "../types/registry-sync.types"

const NOW = new Date("2026-10-06T08:00:00Z")
const SETTINGS: RegistrySyncSettings = { daysBack: 1, daysAhead: 1, periodSeconds: 3600 }
const SYSTEM = "urn:oid:2.25.1"
const RUN_ID = "00000000-0000-4000-8000-000000000001"

function identifier(value: string): PatientIdentifier {
	return { system: SYSTEM, value, issuer: "MOU" }
}

function patient(value: string): PatientRecord {
	return {
		identifiers: [identifier(value)],
		familyName: "Svobodová",
		givenName: "Marie",
		birthDate: "1950-02-01",
		sex: PATIENT_SEX.FEMALE,
	}
}

function scheduled(value: string, studyInstanceUid: string): ScheduledEncounter {
	return {
		patient: patient(value),
		studyInstanceUid,
		accessionNumber: "A1",
		identifiers: [],
		scheduledDate: "2026-10-06",
		scheduledTime: "09:00:00",
	}
}

interface SourceAnswers {
	worklist?: (interval: DayInterval) => RegistryQueryOutcome
	encounters?: ScheduledEncounter[]
	studies?: PatientRecord[]
	lookup?: PatientRecord[]
	failure?: Error
}

function sourceWith(answers: SourceAnswers) {
	const lookups: PatientIdentifier[] = []
	const source: RegistrySourcePort = {
		scheduledEncounters: async (interval) => {
			if (answers.failure !== undefined) {
				throw answers.failure
			}
			return {
				outcome: answers.worklist?.(interval) ?? REGISTRY_QUERY_OUTCOME.COMPLETE,
				matches: answers.encounters ?? [],
				characterSetMissing: false,
			}
		},
		studyPatients: async () => ({
			outcome: REGISTRY_QUERY_OUTCOME.COMPLETE,
			matches: answers.studies ?? [],
			characterSetMissing: false,
		}),
		patient: async (wanted) => {
			lookups.push(wanted)
			return { outcome: REGISTRY_QUERY_OUTCOME.COMPLETE, matches: answers.lookup ?? [], characterSetMissing: false }
		},
	}
	return { source, lookups }
}

interface Harness {
	run: () => ReturnType<RegistrySyncService["run"]>
	audits: SystemJobAuditEvent[]
	finished: { outcome: string }[]
	removed: string[]
	patients: PatientGroup[]
	encounters: { studyInstanceUid: string; patientId: string }[]
	lookups: PatientIdentifier[]
}

function harnessWith(
	answers: SourceAnswers,
	options: { abandoned?: SyncRun[]; documented?: DocumentedPatient[]; isLockedElsewhere?: boolean } = {},
): Harness {
	const audits: SystemJobAuditEvent[] = []
	const finished: { outcome: string }[] = []
	const removed: string[] = []
	const patients: PatientGroup[] = []
	const encounters: { studyInstanceUid: string; patientId: string }[] = []
	const { source, lookups } = sourceWith(answers)
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const lock = {
		whileHeld: async (work: () => Promise<unknown>) => (options.isLockedElsewhere === true ? undefined : await work()),
	} as unknown as SyncLockRepository
	const runs = {
		start: async (now: Date) => ({ id: RUN_ID, startedAt: now }),
		finish: async (_tx: never, _runId: string, outcome: string) => {
			finished.push({ outcome })
		},
		fail: async () => {
			finished.push({ outcome: "failed" })
		},
		closeAbandoned: async () => options.abandoned ?? [],
	} as unknown as SyncRunRepository
	const cache = {
		documentedPatients: async () => options.documented ?? [],
		upsertPatient: async (_tx: never, group: PatientGroup) => {
			patients.push(group)
			return { patientId: `patient-${group.identifiers[0]?.value}`, outcome: UPSERT_OUTCOME.ADDED }
		},
		upsertScheduledEncounter: async (_tx: never, encounter: ScheduledEncounter, patientId: string) => {
			encounters.push({ studyInstanceUid: encounter.studyInstanceUid, patientId })
			return UPSERT_OUTCOME.ADDED
		},
		removeUnseen: async (_tx: never, runId: string) => {
			removed.push(runId)
		},
	} as unknown as RegistryCacheRepository
	const audit = {
		appendSystemJob: async (_tx: never, event: SystemJobAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new RegistrySyncService(database, lock, runs, cache, audit)
	return {
		run: () => service.run(source, SETTINGS, NOW),
		audits,
		finished,
		removed,
		patients,
		encounters,
		lookups,
	}
}

describe("registry sync run CAP-024", () => {
	it("CAP-024-S01 fills the cache, removes what left the window and records a complete run", async () => {
		const harness = harnessWith({ encounters: [scheduled("1001", "2.25.10")], studies: [patient("1002")] })

		const run = await harness.run()

		expect(run?.outcome).toBe(REGISTRY_SYNC_OUTCOME.COMPLETE)
		expect(harness.patients.map((group) => group.identifiers[0]?.value)).toEqual(["1001", "1002"])
		expect(harness.encounters).toEqual([{ studyInstanceUid: "2.25.10", patientId: "patient-1001" }])
		expect(harness.removed).toEqual([RUN_ID])
		expect(harness.finished).toEqual([{ outcome: REGISTRY_SYNC_OUTCOME.COMPLETE }])
	})

	it("CAP-024-S02 deletes nothing when the registry answers incompletely", async () => {
		const harness = harnessWith({
			worklist: () => REGISTRY_QUERY_OUTCOME.INCOMPLETE,
			encounters: [scheduled("1001", "2.25.10")],
		})

		const run = await harness.run()

		expect(run?.outcome).toBe(REGISTRY_SYNC_OUTCOME.INCOMPLETE)
		expect(harness.encounters).toHaveLength(1)
		expect(harness.removed).toEqual([])
	})

	it("CAP-024-S02 records an incomplete run without changes when the registry is unreachable", async () => {
		const harness = harnessWith({ failure: new Error("association rejected") })

		const run = await harness.run()

		expect(run?.outcome).toBe(REGISTRY_SYNC_OUTCOME.INCOMPLETE)
		expect(harness.removed).toEqual([])
		expect(harness.finished).toEqual([{ outcome: "failed" }])
		expect(harness.audits[0]?.outcome).toBe(AUDIT_OUTCOME.FAILURE)
		expect(harness.audits[0]?.details).toMatchObject({ patients_added: 0, encounters_added: 0 })
	})

	it("CAP-024-S03 deletes nothing when even one day has too many matches", async () => {
		const harness = harnessWith({ worklist: () => REGISTRY_QUERY_OUTCOME.TOO_MANY_MATCHES })

		const run = await harness.run()

		expect(run?.outcome).toBe(REGISTRY_SYNC_OUTCOME.INCOMPLETE)
		expect(harness.removed).toEqual([])
	})

	it("CAP-025-S18 audits the run as the registry sync job with counts and without patient identifiers", async () => {
		const harness = harnessWith({
			worklist: () => REGISTRY_QUERY_OUTCOME.INCOMPLETE,
			encounters: [scheduled("1001", "2.25.10")],
		})

		await harness.run()

		const [audit] = harness.audits
		expect(audit?.eventType).toBe(AUDIT_EVENT_TYPE.REGISTRY_SYNC_RUN)
		expect(audit?.systemJob).toBe(SYSTEM_JOB.REGISTRY_SYNC)
		expect(audit?.details).toMatchObject({
			started_at: NOW.toISOString(),
			outcome: REGISTRY_SYNC_OUTCOME.INCOMPLETE,
			patients_added: 1,
			patients_changed: 0,
			encounters_added: 1,
			encounters_changed: 0,
		})
		expect(JSON.stringify(audit)).not.toContain("1001")
	})

	it("leaves the cache alone while another worker runs the sync", async () => {
		const harness = harnessWith({ encounters: [scheduled("1001", "2.25.10")] }, { isLockedElsewhere: true })

		const run = await harness.run()

		expect(run).toBeUndefined()
		expect(harness.patients).toEqual([])
		expect(harness.finished).toEqual([])
		expect(harness.audits).toEqual([])
	})

	it("closes a run that a stopped worker left open and audits it", async () => {
		const abandoned: SyncRun = {
			id: "00000000-0000-4000-8000-000000000009",
			startedAt: new Date("2026-10-06T07:00:00Z"),
		}
		const harness = harnessWith({}, { abandoned: [abandoned] })

		await harness.run()

		expect(harness.audits[0]).toMatchObject({ objectId: abandoned.id, outcome: AUDIT_OUTCOME.FAILURE })
	})

	it("CAP-024-R13 refreshes a documented patient that left the window from the registry", async () => {
		const documented: DocumentedPatient = { patientId: "patient-2001", identifiers: [identifier("2001")] }
		const harness = harnessWith(
			{ lookup: [{ ...patient("2001"), familyName: "Nováková" }] },
			{ documented: [documented] },
		)

		await harness.run()

		expect(harness.lookups).toEqual([identifier("2001")])
		expect(harness.patients.map((group) => group.record.familyName)).toEqual(["Nováková"])
	})

	it("CAP-024-R13 does not look up a documented patient the window already brought", async () => {
		const documented: DocumentedPatient = { patientId: "patient-1001", identifiers: [identifier("1001")] }
		const harness = harnessWith({ encounters: [scheduled("1001", "2.25.10")] }, { documented: [documented] })

		await harness.run()

		expect(harness.lookups).toEqual([])
	})
})
