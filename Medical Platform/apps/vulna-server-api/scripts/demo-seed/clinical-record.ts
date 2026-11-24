import { setTimeout as delay } from "node:timers/promises"
import { ACQUISITION_KIND } from "@ansora/contracts"
import type { ClinicalStation } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { SeriesRepository } from "../../src/app/acquisition/repositories/series.repository"
import type { SeriesOwner, SeriesRow } from "../../src/app/acquisition/types/acquisition.types"
import { closedEncounterOf, closedSeriesOf, requiredOf } from "../../src/app/acquisition/utils/closing-content"
import { seriesIdOfDocument } from "../../src/app/acquisition/utils/document-identity"
import { AuditRepository } from "../../src/app/audit/repositories/audit.repository"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../../src/app/clinical-record/constants/clinical-record.constants"
import { ActorTaskRepository } from "../../src/app/clinical-record/repositories/actor-task.repository"
import { ClinicalActorRepository } from "../../src/app/clinical-record/repositories/clinical-actor.repository"
import { ClinicalPatientRepository } from "../../src/app/clinical-record/repositories/clinical-patient.repository"
import { FhirResourceLinkRepository } from "../../src/app/clinical-record/repositories/fhir-resource-link.repository"
import { ActorWriterService } from "../../src/app/clinical-record/services/actor-writer.service"
import { ClinicalContentService } from "../../src/app/clinical-record/services/clinical-content.service"
import { ClinicalRecordStoreService } from "../../src/app/clinical-record/services/clinical-record-store.service"
import { ClosureRecordService } from "../../src/app/clinical-record/services/closure-record.service"
import { DocumentRecordService } from "../../src/app/clinical-record/services/document-record.service"
import { EncounterRecordService } from "../../src/app/clinical-record/services/encounter-record.service"
import { FindingRecordService } from "../../src/app/clinical-record/services/finding-record.service"
import type { ClosedRecord, FindingOwner } from "../../src/app/clinical-record/types/clinical-record.types"
import { CodeListRepository } from "../../src/app/code-list/repositories/code-list.repository"
import type { ConfigurationService } from "../../src/app/configuration/services/configuration.service"
import { EncounterRepository } from "../../src/app/encounter/repositories/encounter.repository"
import type { EncounterRow } from "../../src/app/encounter/types/encounter.types"
import { bodySiteOfRow } from "../../src/app/finding/utils/body-site-view"
import { AdministratorAlertRepository } from "../../src/app/monitoring/repositories/administrator-alert.repository"
import type { EnvVariableService } from "../../src/libs/common/services/env-variable.service"
import type { DatabaseService } from "../../src/libs/database/database.service"
import { DependencyStateService } from "../../src/libs/dependency-state/dependency-state.service"
import { demoId } from "./demo-id"
import type { DemoPlan, PlannedAcquisition, PlannedChange, SeedContext } from "./demo-types"

// Q-040
export const DEMO_STATION: ClinicalStation = { deviceId: demoId("device/demo-station"), model: "Demo" }

export interface OperatorPatience {
	attempts: number
	intervalMilliseconds: number
}

const OPERATOR_PATIENCE: OperatorPatience = { attempts: 30, intervalMilliseconds: 1000 }

export interface ClinicalRecorders {
	stores: ClinicalRecordStoreService
	actorTasks: ActorTaskRepository
	actorWriter: ActorWriterService
	links: FhirResourceLinkRepository
	encounterRows: EncounterRepository
	encounters: EncounterRecordService
	findings: FindingRecordService
	documents: DocumentRecordService
	closures: ClosureRecordService
	series: SeriesRepository
}

interface RecordedVisit {
	encounter: EncounterRow
	acquisition: PlannedAcquisition
}

interface DemoEvent {
	moment: Date
	write: () => Promise<void>
}

// ADR-054 bod 1, ADR-054 bod 3
export function clinicalRecordersOf(
	database: DatabaseService,
	env: EnvVariableService,
	configuration: ConfigurationService,
): ClinicalRecorders {
	const stores = new ClinicalRecordStoreService(configuration, env, new DependencyStateService())
	const actors = new ClinicalActorRepository(database)
	const links = new FhirResourceLinkRepository()
	const content = new ClinicalContentService(actors, links, new CodeListRepository(), configuration)
	const actorTasks = new ActorTaskRepository(
		database,
		new AdministratorAlertRepository(database),
		new AuditRepository(),
	)
	return {
		stores,
		actorTasks,
		actorWriter: new ActorWriterService(actorTasks, actors, database, links, stores),
		links,
		encounterRows: new EncounterRepository(database),
		encounters: new EncounterRecordService(stores, new ClinicalPatientRepository(), actors, links),
		findings: new FindingRecordService(stores, content, links),
		documents: new DocumentRecordService(stores, content, links),
		closures: new ClosureRecordService(stores, content, actors, links),
		series: new SeriesRepository(),
	}
}

// ADR-054 bod 5
export async function requireClinicalRecordStore(recorders: ClinicalRecorders): Promise<void> {
	if ((await recorders.stores.current()) === undefined) {
		throw new Error(
			"The clinical record store has no address or credential; the closed demo records are written into it",
		)
	}
}

// CAP-001-R31, ADR-053 bod 6
async function writeWaitingActors(recorders: ClinicalRecorders): Promise<void> {
	while (await recorders.actorWriter.writeNext()) {}
}

// datovy-model.md 13.2
async function isRecordedActor(
	tx: postgres.TransactionSql,
	recorders: ClinicalRecorders,
	userId: string,
): Promise<boolean> {
	const membership = await recorders.links.resourceIdOf(tx, {
		resourceType: FHIR_RESOURCE_TYPE.PROJECT_MEMBERSHIP,
		localKind: LOCAL_KIND.ACTOR,
		localId: userId,
	})
	return membership !== undefined
}

// ADR-050, CAP-021-R38, ADR-053 bod 6
export async function requireRecordedOperator(
	tx: postgres.TransactionSql,
	recorders: ClinicalRecorders,
	operatorUserId: string,
	patience: OperatorPatience = OPERATOR_PATIENCE,
): Promise<void> {
	for (let attempt = 1; attempt <= patience.attempts; attempt += 1) {
		await writeWaitingActors(recorders)
		if (await isRecordedActor(tx, recorders, operatorUserId)) {
			return
		}
		if (attempt < patience.attempts) {
			await delay(patience.intervalMilliseconds)
		}
	}
	throw new Error(
		`The demo clinician ${operatorUserId} is not in the clinical record store after ${patience.attempts} attempts; their actor write has not succeeded`,
	)
}

function byMoment<T>(momentOf: (item: T) => Date): (first: T, second: T) => number {
	return (first, second) => momentOf(first).getTime() - momentOf(second).getTime()
}

// ADR-050, CAP-021-R11
async function seriesOf(
	tx: postgres.TransactionSql,
	recorders: ClinicalRecorders,
	owner: SeriesOwner,
	seriesId: string,
): Promise<SeriesRow> {
	await recorders.series.lockEncounter(tx, owner.encounterId)
	return await recorders.series.assign(tx, owner, seriesId)
}

// CAP-021-R13, ADR-050
function closedRecordOf(context: SeedContext, visit: RecordedVisit, series: SeriesRow): ClosedRecord {
	const { encounter, acquisition } = visit
	return {
		acquisitionId: acquisition.id,
		patientId: acquisition.patient_id,
		departmentId: context.departmentId,
		operatorUserId: context.operatorUserId,
		station: DEMO_STATION,
		startedAt: acquisition.started_at,
		closedAt: acquisition.closed_at,
		encounter: closedEncounterOf(encounter),
		series: closedSeriesOf(series),
	}
}

// CAP-016-R17, CAP-017-R02, CAP-017-R03, CAP-021-S21
async function recordWound(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	recorders: ClinicalRecorders,
	visit: RecordedVisit,
): Promise<void> {
	const { encounter, acquisition } = visit
	const finding = requiredOf(
		plan.findings.find((candidate) => candidate.id === acquisition.finding_id),
		"finding",
		acquisition.id,
	)
	const site = bodySiteOfRow(
		requiredOf(
			plan.sites.find((candidate) => candidate.acquisition_id === acquisition.id),
			"body site",
			acquisition.id,
		),
	)
	const assessment = requiredOf(
		plan.assessments.find((candidate) => candidate.acquisition_id === acquisition.id),
		"assessment",
		acquisition.id,
	)
	const owner: FindingOwner = {
		findingId: finding.id,
		acquisitionId: acquisition.id,
		patientId: acquisition.patient_id,
		departmentId: context.departmentId,
	}
	// CAP-020-R19
	const woundTypeCode = acquisition.closed_wound_type_code ?? undefined
	const isFirstRecordOfFinding = finding.origin_acquisition_id === acquisition.id
	if (isFirstRecordOfFinding) {
		await recorders.findings.recordDraft(tx, { ...owner, site })
		if (woundTypeCode !== undefined) {
			await recorders.findings.recordWoundType(tx, { ...owner, woundTypeCode })
		}
	}
	await recorders.findings.recordAssessment(tx, {
		...owner,
		bodyDiagramVersion: site.bodyDiagramVersion,
		healingPhaseCode: assessment.healing_phase_code,
		description: assessment.description,
	})
	const series = await seriesOf(
		tx,
		recorders,
		{ encounterId: encounter.id, findingId: finding.id },
		demoId(`${acquisition.id}/series`),
	)
	await recorders.closures.recordWound(tx, {
		...closedRecordOf(context, visit, series),
		findingId: finding.id,
		isFirstRecordOfFinding,
		site,
		woundTypeCode,
		healingPhaseCode: assessment.healing_phase_code,
		description: assessment.description,
	})
}

// CAP-021-R28, CAP-021-R39, CAP-021-S35
async function recordScan(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	recorders: ClinicalRecorders,
	visit: RecordedVisit,
): Promise<void> {
	const { encounter, acquisition } = visit
	const document = requiredOf(
		plan.documents.find((candidate) => candidate.acquisition_id === acquisition.id),
		"document",
		acquisition.id,
	)
	const titleCode = requiredOf(context.titleCodes.get(document.title), "document title", acquisition.id)
	const series = await seriesOf(
		tx,
		recorders,
		{ encounterId: encounter.id, documentId: document.id },
		seriesIdOfDocument(document.id),
	)
	await recorders.documents.recordDraft(tx, {
		documentId: document.id,
		acquisitionId: acquisition.id,
		departmentId: context.departmentId,
		patientId: acquisition.patient_id,
		encounter: closedEncounterOf(encounter),
		series: closedSeriesOf(series),
	})
	await recorders.closures.recordScan(tx, {
		...closedRecordOf(context, visit, series),
		documentId: document.id,
		titleCode,
		titleText: null,
		pageCount: acquisition.file_count,
	})
}

async function recordAcquisition(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	recorders: ClinicalRecorders,
	visit: RecordedVisit,
): Promise<void> {
	switch (visit.acquisition.kind) {
		case ACQUISITION_KIND.PHOTO:
			await recordWound(tx, plan, context, recorders, visit)
			return
		case ACQUISITION_KIND.SCAN:
			await recordScan(tx, plan, context, recorders, visit)
			return
		default:
			return visit.acquisition.kind satisfies never
	}
}

// CAP-020-R21, CAP-020-S25
async function recordWoundTypeChange(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	recorders: ClinicalRecorders,
	change: PlannedChange,
): Promise<void> {
	const finding = plan.findings.find((candidate) => candidate.id === change.finding_id)
	if (finding === undefined) {
		throw new Error(`The demo wound type change ${change.id} names an unknown finding`)
	}
	await recorders.findings.recordWoundTypeChange(tx, {
		changeId: change.id,
		findingId: finding.id,
		patientId: finding.patient_id,
		departmentId: context.departmentId,
		woundTypeCode: change.wound_type_code,
		changedAt: change.changed_at,
		changedBy: context.operatorUserId,
	})
}

async function recordedEncounters(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	recorders: ClinicalRecorders,
): Promise<Map<string, EncounterRow>> {
	const encounters = new Map<string, EncounterRow>()
	for (const planned of [...plan.encounters].sort(byMoment((encounter) => encounter.started_at))) {
		const encounter = await recorders.encounterRows.findById(tx, planned.id)
		if (encounter === undefined) {
			throw new Error(`The demo visit ${planned.id} was not written`)
		}
		await recorders.encounters.record(tx, encounter)
		encounters.set(encounter.id, encounter)
	}
	return encounters
}

// ADR-054 bod 1, ADR-054 bod 5, CAP-021-R27, CAP-020-R21
export async function recordClinicalHistory(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	recorders: ClinicalRecorders,
): Promise<void> {
	const encounters = await recordedEncounters(tx, plan, recorders)
	const events: DemoEvent[] = [
		...plan.acquisitions.map((acquisition) => ({
			moment: acquisition.closed_at,
			write: async () => {
				const encounter = requiredOf(encounters.get(acquisition.encounter_id), "visit", acquisition.id)
				await recordAcquisition(tx, plan, context, recorders, { encounter, acquisition })
			},
		})),
		...plan.changes.map((change) => ({
			moment: change.changed_at,
			write: async () => await recordWoundTypeChange(tx, plan, context, recorders, change),
		})),
	]
	for (const event of events.sort(byMoment((candidate) => candidate.moment))) {
		await event.write()
	}
}
