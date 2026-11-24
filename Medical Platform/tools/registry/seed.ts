// Mock, remove later
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ENCOUNTER_STATUS } from "@ansora/contracts"
import {
	calendarDayIn,
	ENCOUNTER_SOURCE,
	IDENTIFIER_SOURCE,
	INSTANCE_TIME_ZONE,
	PATIENT_ORIGIN,
	shiftedDay,
} from "@ansora/vulna-domain"
import postgres from "@veevoy/postgres"

const DATASET = resolve(__dirname, "../../quality/data/synteticka-sada/registry.json")
const DATABASE_URL = "DATABASE_URL_WORKER"
const UID_ROOT = "2.25"

interface SyntheticPatient {
	key: string
	id: string
	issuer: string
	familyName: string
	givenName: string | null
	birthDate: string
	sex: string | null
}

interface SyntheticEncounter {
	patient: string
	dayOffset: number
	time: string | null
	accessionNumber: string | null
	admissionId: string | null
}

interface SeededPatient {
	id: string
	issuer: string
}

interface SyntheticRegistry {
	patientIdSystem: string
	admissionIdSystem: string
	patients: SyntheticPatient[]
	scheduledEncounters: SyntheticEncounter[]
}

// integrace-dicom.md 4
function studyInstanceUid(): string {
	return `${UID_ROOT}.${BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString()}`
}

async function removePrevious(tx: postgres.TransactionSql, system: string): Promise<void> {
	await tx`
		DELETE FROM encounter e
		WHERE e.source = ${ENCOUNTER_SOURCE.WORKLIST}
			AND e.status = ${ENCOUNTER_STATUS.PLANNED}
			AND EXISTS (SELECT 1 FROM patient_identifier i WHERE i.patient_id = e.patient_id AND i.system = ${system})
	`
	await tx`
		DELETE FROM patient_cache p
		WHERE p.origin = ${PATIENT_ORIGIN.REGISTRY}
			AND EXISTS (SELECT 1 FROM patient_identifier i WHERE i.patient_id = p.id AND i.system = ${system})
			AND NOT EXISTS (SELECT 1 FROM encounter e WHERE e.patient_id = p.id)
	`
}

async function insertPatient(tx: postgres.TransactionSql, system: string, patient: SyntheticPatient): Promise<string> {
	const [existing] = await tx<{ patient_id: string }[]>`
		SELECT patient_id FROM patient_identifier
		WHERE system = ${system} AND value = ${patient.id} AND issuer = ${patient.issuer}
	`
	if (existing !== undefined) {
		return existing.patient_id
	}
	const patientId = randomUUID()
	await tx`
		INSERT INTO patient_cache (id, family_name, given_name, birth_date, sex, origin)
		VALUES (
			${patientId}, ${patient.familyName}, ${patient.givenName}, ${patient.birthDate}::date, ${patient.sex},
			${PATIENT_ORIGIN.REGISTRY}
		)
	`
	await tx`
		INSERT INTO patient_identifier (id, patient_id, system, value, issuer, source)
		VALUES (${randomUUID()}, ${patientId}, ${system}, ${patient.id}, ${patient.issuer}, ${IDENTIFIER_SOURCE.WORKLIST})
	`
	return patientId
}

async function insertEncounter(
	tx: postgres.TransactionSql,
	registry: SyntheticRegistry,
	encounter: SyntheticEncounter,
	patient: SeededPatient,
	today: string,
): Promise<void> {
	const encounterId = randomUUID()
	await tx`
		INSERT INTO encounter (id, patient_id, source, status, date, scheduled_time, study_instance_uid, accession_number)
		VALUES (
			${encounterId}, ${patient.id}, ${ENCOUNTER_SOURCE.WORKLIST}, ${ENCOUNTER_STATUS.PLANNED}, ${shiftedDay(today, encounter.dayOffset)}::date,
			${encounter.time}::time, ${studyInstanceUid()}, ${encounter.accessionNumber}
		)
	`
	if (encounter.admissionId === null) {
		return
	}
	await tx`
		INSERT INTO encounter_identifier (id, encounter_id, system, value, issuer, source)
		VALUES (
			${randomUUID()}, ${encounterId}, ${registry.admissionIdSystem}, ${encounter.admissionId}, ${patient.issuer},
			${IDENTIFIER_SOURCE.WORKLIST}
		)
	`
}

async function seed(sql: postgres.Sql, registry: SyntheticRegistry): Promise<void> {
	const today = calendarDayIn(INSTANCE_TIME_ZONE, new Date())
	await sql.begin(async (tx: postgres.TransactionSql) => {
		await removePrevious(tx, registry.patientIdSystem)
		const patients = new Map<string, SeededPatient>()
		for (const patient of registry.patients) {
			patients.set(patient.key, {
				id: await insertPatient(tx, registry.patientIdSystem, patient),
				issuer: patient.issuer,
			})
		}
		for (const encounter of registry.scheduledEncounters) {
			const patient = patients.get(encounter.patient)
			if (patient === undefined) {
				throw new Error(`The synthetic encounter names patient ${encounter.patient}, who is not in the dataset`)
			}
			await insertEncounter(tx, registry, encounter, patient, today)
		}
	})
	process.stdout.write(`synthetic patients\t${registry.patients.length}\n`)
	process.stdout.write(`planned encounters\t${registry.scheduledEncounters.length} from ${today}\n`)
}

async function main(): Promise<void> {
	const url = process.env[DATABASE_URL]
	if (url === undefined || url === "") {
		throw new Error(`Set ${DATABASE_URL}; the seed writes the registry cache under the worker role`)
	}
	const registry = JSON.parse(readFileSync(DATASET, "utf8")) as SyntheticRegistry
	const sql = postgres(url, { onnotice: () => {} })
	try {
		await seed(sql, registry)
	} finally {
		await sql.end()
	}
}

main().catch((failure: unknown) => {
	process.stderr.write(`registry seed failed: ${failure instanceof Error ? failure.message : String(failure)}\n`)
	process.exitCode = 1
})
