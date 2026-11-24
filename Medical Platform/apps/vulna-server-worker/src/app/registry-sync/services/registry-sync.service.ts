import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, REGISTRY_SYNC_OUTCOME, SYSTEM_JOB } from "@ansora/contracts"
import type { AuditOutcome, JsonObject } from "@ansora/core-server"
import {
	calendarDayIn,
	collectByInterval,
	groupKeysByIdentifier,
	INSTANCE_TIME_ZONE,
	identifierKeyOf,
	patientGroupsOf,
	REGISTRY_QUERY_OUTCOME,
	REGISTRY_RECORD_SOURCE,
	type RegistrySourcePort,
	type SourcedPatientRecord,
	syncWindowOf,
	uniqueEncountersOf,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { DatabaseService } from "../../../libs/database/database.service"
import { UPSERT_OUTCOME, type UpsertOutcome } from "../constants/registry-sync.constants"
import { RegistryCacheRepository } from "../repositories/registry-cache.repository"
import { SyncLockRepository } from "../repositories/sync-lock.repository"
import { SyncRunRepository } from "../repositories/sync-run.repository"
import type {
	DocumentedRefresh,
	FinishedSyncRun,
	RegistrySnapshot,
	RegistrySyncSettings,
	SyncCounts,
	SyncRun,
} from "../types/registry-sync.types"

const NO_CHANGES: SyncCounts = { patientsAdded: 0, patientsChanged: 0, encountersAdded: 0, encountersChanged: 0 }

// CAP-025-R14, administration.yaml AuditRecord.registry_sync_run
function auditDetailsOf(run: FinishedSyncRun): JsonObject {
	return {
		started_at: run.startedAt.toISOString(),
		finished_at: run.finishedAt.toISOString(),
		outcome: run.outcome,
		patients_added: run.patientsAdded,
		patients_changed: run.patientsChanged,
		encounters_added: run.encountersAdded,
		encounters_changed: run.encountersChanged,
	}
}

// CAP-024-R08
function failedRunOf(run: SyncRun, finishedAt: Date): FinishedSyncRun {
	return { ...run, ...NO_CHANGES, outcome: REGISTRY_SYNC_OUTCOME.INCOMPLETE, finishedAt }
}

function countOf(outcome: UpsertOutcome, counted: UpsertOutcome): number {
	return outcome === counted ? 1 : 0
}

function countedPatient(counts: SyncCounts, outcome: UpsertOutcome): SyncCounts {
	return {
		...counts,
		patientsAdded: counts.patientsAdded + countOf(outcome, UPSERT_OUTCOME.ADDED),
		patientsChanged: counts.patientsChanged + countOf(outcome, UPSERT_OUTCOME.CHANGED),
	}
}

function countedEncounter(counts: SyncCounts, outcome: UpsertOutcome): SyncCounts {
	return {
		...counts,
		encountersAdded: counts.encountersAdded + countOf(outcome, UPSERT_OUTCOME.ADDED),
		encountersChanged: counts.encountersChanged + countOf(outcome, UPSERT_OUTCOME.CHANGED),
	}
}

// CAP-024-R01, CAP-024-R08, CAP-024-R09, CAP-024-R12, CAP-024-R13, CAP-024-R14
@Injectable()
export class RegistrySyncService {
	private readonly logger = new Logger(RegistrySyncService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly lock: SyncLockRepository,
		private readonly runs: SyncRunRepository,
		private readonly cache: RegistryCacheRepository,
		private readonly audit: AuditRepository,
	) {}

	// CAP-024-S01, CAP-024-S02
	async run(
		source: RegistrySourcePort,
		settings: RegistrySyncSettings,
		now: Date,
	): Promise<FinishedSyncRun | undefined> {
		return await this.lock.whileHeld(async () => {
			await this.closeAbandonedRuns(now)
			const run = await this.runs.start(now)
			try {
				return await this.apply(run, await this.snapshotOf(source, settings, now))
			} catch (error) {
				this.logger.error(`Registry sync run ${run.id} failed`, error)
				return await this.finishWithoutChanges(run)
			}
		})
	}

	private async snapshotOf(
		source: RegistrySourcePort,
		settings: RegistrySyncSettings,
		now: Date,
	): Promise<RegistrySnapshot> {
		const window = syncWindowOf(calendarDayIn(INSTANCE_TIME_ZONE, now), settings.daysBack, settings.daysAhead)
		const scheduled = await collectByInterval((interval) => source.scheduledEncounters(interval), window)
		const studies = await collectByInterval((interval) => source.studyPatients(interval), window)
		const records: SourcedPatientRecord[] = [
			...scheduled.matches.map((encounter) => ({
				record: encounter.patient,
				source: REGISTRY_RECORD_SOURCE.WORKLIST,
			})),
			...studies.matches.map((record) => ({ record, source: REGISTRY_RECORD_SOURCE.QUERY })),
		]
		const refreshed = await this.documentedRefresh(source, records)
		return {
			patients: patientGroupsOf([...records, ...refreshed.records]),
			encounters: uniqueEncountersOf(scheduled.matches),
			isComplete: scheduled.isComplete && studies.isComplete && refreshed.isComplete,
			characterSetMissing:
				scheduled.characterSetMissing || studies.characterSetMissing || refreshed.characterSetMissing,
		}
	}

	// CAP-024-R13
	private async documentedRefresh(
		source: RegistrySourcePort,
		seenRecords: readonly SourcedPatientRecord[],
	): Promise<DocumentedRefresh> {
		const seen = new Set(seenRecords.flatMap(({ record }) => record.identifiers.map(identifierKeyOf)))
		const refresh: DocumentedRefresh = { records: [], isComplete: true, characterSetMissing: false }
		for (const patient of await this.cache.documentedPatients()) {
			const [identifier] = patient.identifiers
			if (identifier === undefined || patient.identifiers.some((known) => seen.has(identifierKeyOf(known)))) {
				continue
			}
			const result = await source.patient(identifier)
			const key = identifierKeyOf(identifier)
			refresh.records.push(
				...result.matches
					.filter((record) => record.identifiers.some((candidate) => identifierKeyOf(candidate) === key))
					.map((record) => ({ record, source: REGISTRY_RECORD_SOURCE.QUERY })),
			)
			refresh.isComplete &&= result.outcome === REGISTRY_QUERY_OUTCOME.COMPLETE
			refresh.characterSetMissing ||= result.characterSetMissing
		}
		return refresh
	}

	private async apply(run: SyncRun, snapshot: RegistrySnapshot): Promise<FinishedSyncRun> {
		const finished = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			let counts = NO_CHANGES
			const patientIds = new Map<string, string>()
			for (const group of snapshot.patients) {
				const upsert = await this.cache.upsertPatient(tx, group, run.id)
				patientIds.set(group.key, upsert.patientId)
				counts = countedPatient(counts, upsert.outcome)
			}
			const groupKeys = groupKeysByIdentifier(snapshot.patients)
			for (const encounter of snapshot.encounters) {
				const [identifier] = encounter.patient.identifiers
				const groupKey = identifier === undefined ? undefined : groupKeys.get(identifierKeyOf(identifier))
				const patientId = groupKey === undefined ? undefined : patientIds.get(groupKey)
				if (patientId === undefined) {
					continue
				}
				counts = countedEncounter(counts, await this.cache.upsertScheduledEncounter(tx, encounter, patientId, run.id))
			}
			if (snapshot.isComplete) {
				await this.cache.removeUnseen(tx, run.id)
			}
			const outcome = snapshot.isComplete ? REGISTRY_SYNC_OUTCOME.COMPLETE : REGISTRY_SYNC_OUTCOME.INCOMPLETE
			const result: FinishedSyncRun = { ...run, ...counts, outcome, finishedAt: new Date() }
			await this.runs.finish(tx, run.id, outcome, result.finishedAt)
			await this.auditRun(tx, result, AUDIT_OUTCOME.SUCCESS)
			return result
		})
		if (snapshot.characterSetMissing) {
			this.logger.warn(`Registry sync run ${run.id}: the registry answered without Specific Character Set`)
		}
		this.logger.log(`Registry sync run ${run.id} finished ${finished.outcome}`)
		return finished
	}

	private async finishWithoutChanges(run: SyncRun): Promise<FinishedSyncRun> {
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const result = failedRunOf(run, new Date())
			await this.runs.fail(tx, run.id, result.finishedAt)
			await this.auditRun(tx, result, AUDIT_OUTCOME.FAILURE)
			return result
		})
	}

	private async closeAbandonedRuns(now: Date): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			for (const run of await this.runs.closeAbandoned(tx, now)) {
				await this.auditRun(tx, failedRunOf(run, now), AUDIT_OUTCOME.FAILURE)
			}
		})
	}

	// CAP-025-R14, CAP-025-S18
	private async auditRun(tx: postgres.TransactionSql, run: FinishedSyncRun, outcome: AuditOutcome): Promise<void> {
		await this.audit.appendSystemJob(
			tx,
			{
				eventType: AUDIT_EVENT_TYPE.REGISTRY_SYNC_RUN,
				systemJob: SYSTEM_JOB.REGISTRY_SYNC,
				objectId: run.id,
				outcome,
				details: auditDetailsOf(run),
			},
			run.finishedAt,
		)
	}
}
