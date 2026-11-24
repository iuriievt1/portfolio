import "reflect-metadata"
import { CODE_LIST } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"
import { AcquisitionFileRepository } from "../../src/app/acquisition/repositories/acquisition-file.repository"
import { BinaryObjectRepository } from "../../src/app/binary-object/repositories/binary-object.repository"
import { BinaryObjectService } from "../../src/app/binary-object/services/binary-object.service"
import { localBinaryStoreOf } from "../../src/app/binary-object/utils/local-binary-store"
import { EnvVariableService } from "../../src/libs/common/services/env-variable.service"
import { DatabaseService } from "../../src/libs/database/database.service"
import {
	type ClinicalRecorders,
	clinicalRecordersOf,
	recordClinicalHistory,
	requireClinicalRecordStore,
	requireRecordedOperator,
} from "./clinical-record"
import { configurationOf } from "./configuration"
import {
	codeListVersionOf,
	configurationVersionOf,
	operatorOf,
	patientIdOf,
	requireOffered,
	requireTitles,
	STAND_OPERATOR,
} from "./context"
import { DEMO_DATASET } from "./dataset"
import type { DemoDataset, DemoPlan, SeedContext } from "./demo-types"
import { SeedFileStore } from "./file-store"
import { mergedPlan, planOf } from "./plan"
import { prepareStand } from "./stand"
import {
	assignWorklistDepartment,
	removeSeeded,
	writeDocuments,
	writeEncounters,
	writeImages,
	writeRecords,
} from "./writer"

const PERSONAL_NUMBER_ARGUMENT = 2
// Q-040
const STAND_OPERATOR_VARIABLE = "DEMO_STAND_OPERATOR"
const ENABLED = "1"

interface SeedOutcome {
	plan: DemoPlan
	removedBinaryObjectIds: string[]
	worklistVisits: number
}

interface SeedInput {
	personalNumber: string | undefined
	defaultLanguage: string
	hasStandOperator: boolean
}

// CAP-017-R08, CAP-017-R16
async function requireCodes(tx: postgres.TransactionSql, dataset: DemoDataset): Promise<void> {
	const wounds = dataset.patients.flatMap((patient) => patient.wounds)
	const woundTypes = wounds.flatMap((wound) =>
		wound.change === undefined ? [wound.woundType] : [wound.woundType, wound.change.from],
	)
	const phases = wounds.flatMap((wound) => wound.records.map((record) => record.healingPhase))
	await requireOffered(tx, CODE_LIST.WOUND_TYPE, woundTypes)
	await requireOffered(tx, CODE_LIST.HEALING_PHASE, phases)
}

async function contextOf(tx: postgres.TransactionSql, dataset: DemoDataset, input: SeedInput): Promise<SeedContext> {
	const operator = await operatorOf(tx, input.hasStandOperator ? STAND_OPERATOR.personalNumber : input.personalNumber)
	await requireCodes(tx, dataset)
	const titleCodes = await requireTitles(tx, dataset.titles, input.defaultLanguage)
	return {
		operatorUserId: operator.userId,
		departmentId: operator.departmentId,
		configurationVersionId: await configurationVersionOf(tx),
		codeListVersion: await codeListVersionOf(tx),
		titleCodes,
	}
}

async function planFor(tx: postgres.TransactionSql, dataset: DemoDataset): Promise<DemoPlan> {
	const plans: DemoPlan[] = []
	for (const patient of dataset.patients) {
		plans.push(planOf(patient, await patientIdOf(tx, dataset, patient.identifier)))
	}
	return mergedPlan(plans)
}

async function seed(
	database: DatabaseService,
	binaries: BinaryObjectService,
	files: SeedFileStore,
	recorders: ClinicalRecorders,
	input: SeedInput,
): Promise<SeedOutcome> {
	return await database.sql.begin(async (tx: postgres.TransactionSql) => {
		const context = await contextOf(tx, DEMO_DATASET, input)
		await requireRecordedOperator(tx, recorders, context.operatorUserId)
		const plan = await planFor(tx, DEMO_DATASET)
		const removed = await removeSeeded(tx, plan, new AcquisitionFileRepository(), binaries)
		await writeEncounters(tx, plan, context)
		await writeRecords(tx, plan, context)
		await writeImages(tx, plan, files)
		await writeDocuments(tx, plan, context, files)
		// ADR-054 bod 1, CAP-020-R16
		await recordClinicalHistory(tx, plan, context, recorders)
		const worklistVisits = await assignWorklistDepartment(tx, context)
		return { plan, removedBinaryObjectIds: removed, worklistVisits }
	})
}

// CAP-026-R17
async function seededOrDiscarded(
	database: DatabaseService,
	binaries: BinaryObjectService,
	recorders: ClinicalRecorders,
	input: SeedInput,
): Promise<SeedOutcome> {
	const files = new SeedFileStore(binaries)
	try {
		return await seed(database, binaries, files, recorders, input)
	} catch (error) {
		await files.discardStored()
		throw error
	}
}

async function main(): Promise<void> {
	const env = new EnvVariableService()
	const database = new DatabaseService(env)
	const configuration = configurationOf(database)
	const binaries = new BinaryObjectService(localBinaryStoreOf(env), new BinaryObjectRepository())
	const recorders = clinicalRecordersOf(database, env, configuration)
	const hasStandOperator = process.env[STAND_OPERATOR_VARIABLE] === ENABLED
	try {
		await requireClinicalRecordStore(recorders)
		if (hasStandOperator) {
			await prepareStand(database, configuration, recorders.actorTasks, DEMO_DATASET)
		}
		const { plan, removedBinaryObjectIds, worklistVisits } = await seededOrDiscarded(database, binaries, recorders, {
			personalNumber: process.argv[PERSONAL_NUMBER_ARGUMENT],
			// CAP-012-R28
			defaultLanguage: await configuration.instanceDefaultLanguage(),
			hasStandOperator,
		})
		// CAP-026-R17
		await binaries.discardBytes(removedBinaryObjectIds)
		process.stdout.write(`demo visits\t${plan.encounters.length}\n`)
		process.stdout.write(`demo wounds\t${plan.findings.length}\n`)
		process.stdout.write(`demo records\t${plan.acquisitions.length - plan.documents.length}\n`)
		process.stdout.write(`demo documents\t${plan.documents.length}\n`)
		process.stdout.write(`demo files\t${plan.images.length + plan.pages.length}\n`)
		process.stdout.write(`worklist visits with department\t${worklistVisits}\n`)
	} finally {
		await database.onApplicationShutdown()
	}
}

main().catch((failure: unknown) => {
	process.stderr.write(`demo seed failed: ${failure instanceof Error ? failure.message : String(failure)}\n`)
	process.exitCode = 1
})
