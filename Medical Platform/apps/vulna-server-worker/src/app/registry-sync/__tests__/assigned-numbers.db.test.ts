import { randomUUID } from "node:crypto"
import type postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import { administrator, closedRecord, rolledBack } from "../../clinical-record-upload/__tests__/sql-fixtures"

// ADR-005 ř. 37, ADR-021
const WORKER_ROLE = "vulna_worker"
const API_ROLE = "vulna_api"
const REJECTED_CHANGE = "never changes"
const STUDY_ID_OF_2026 = /^2026-\d{6,11}$/
const STUDY_ID_OF_2027 = /^2027-\d{6,11}$/
const RESTORED_WOUND_NUMBER = 4

afterAll(async () => {
	await administrator.end()
})

type Transaction = postgres.TransactionSql

interface StoredEncounter {
	id: string
	study_id: string
}

interface PatientRecord {
	acquisitionId: string
	encounterId: string
	patientId: string
	operatorUserId: string
}

async function newPatient(tx: Transaction): Promise<string> {
	const patientId = randomUUID()
	await tx`INSERT INTO patient_cache (id) VALUES (${patientId})`
	return patientId
}

async function worklistEncounter(tx: Transaction, patientId: string, date: string): Promise<StoredEncounter> {
	const id = randomUUID()
	const [row] = await tx<StoredEncounter[]>`
		INSERT INTO encounter (id, patient_id, source, status, date, study_instance_uid)
		VALUES (${id}, ${patientId}, 'worklist', 'planned', ${date}::date, ${`2.25.${BigInt(`0x${id.replaceAll("-", "")}`)}`})
		RETURNING id, study_id
	`
	if (row === undefined) {
		throw new Error(`the encounter ${id} was not stored`)
	}
	return row
}

function studyNumberOf(encounter: StoredEncounter): number {
	return Number(encounter.study_id.slice(encounter.study_id.indexOf("-") + 1))
}

async function patientRecord(tx: Transaction): Promise<PatientRecord> {
	const { acquisitionId, encounterId } = await closedRecord(tx, "photo")
	const [row] = await tx<{ patient_id: string; operator_user_id: string }[]>`
		SELECT patient_id, operator_user_id FROM acquisition WHERE id = ${acquisitionId}
	`
	if (row === undefined) {
		throw new Error(`the record ${acquisitionId} was not stored`)
	}
	return { acquisitionId, encounterId, patientId: row.patient_id, operatorUserId: row.operator_user_id }
}

async function newFinding(tx: Transaction, record: PatientRecord, woundNumber: number | null = null): Promise<string> {
	const id = randomUUID()
	await tx`
		INSERT INTO finding (id, patient_id, finding_key, origin_acquisition_id, created_by, wound_number)
		VALUES (${id}, ${record.patientId}, ${randomUUID()}, ${record.acquisitionId}, ${record.operatorUserId},
			${woundNumber})
	`
	return id
}

async function draftOf(tx: Transaction, record: PatientRecord, findingId: string): Promise<string> {
	const id = randomUUID()
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, finding_id, kind, state, operator_user_id,
			configuration_version_id, started_at)
		VALUES (${id}, ${randomUUID()}, ${record.patientId}, ${record.encounterId}, ${findingId}, 'photo', 'draft',
			${record.operatorUserId}, (SELECT max(id) FROM configuration_version), now())
	`
	return id
}

async function close(tx: Transaction, acquisitionId: string): Promise<void> {
	await tx`UPDATE acquisition SET state = 'received', closed_at = now(), file_count = 1 WHERE id = ${acquisitionId}`
}

async function woundNumberOf(tx: Transaction, findingId: string): Promise<number | null> {
	const [row] = await tx<{ wound_number: number | null }[]>`SELECT wound_number FROM finding WHERE id = ${findingId}`
	if (row === undefined) {
		throw new Error(`the finding ${findingId} is gone`)
	}
	return row.wound_number
}

// db/migrations/0051, db/migrations/0052
describe("numbers the database assigns", () => {
	it("integrace-dicom.md 5.2 gives every visit the worker stores a Study ID of its year that never changes", async () => {
		await rolledBack(async (tx) => {
			const patientId = await newPatient(tx)
			await tx`SET LOCAL ROLE ${tx(WORKER_ROLE)}`

			const first = await worklistEncounter(tx, patientId, "2026-12-31")
			const next = await worklistEncounter(tx, patientId, "2027-01-02")

			expect(first.study_id).toMatch(STUDY_ID_OF_2026)
			expect(next.study_id).toMatch(STUDY_ID_OF_2027)
			expect(studyNumberOf(next)).toBe(studyNumberOf(first) + 1)
			await expect(
				tx.savepoint((point) => point`UPDATE encounter SET study_id = '2026-999999' WHERE id = ${first.id}`),
			).rejects.toThrow(REJECTED_CHANGE)
		})
	})

	it("CAP-020-R23 numbers a wound when its first record closes and never gives a number twice", async () => {
		await rolledBack(async (tx) => {
			const record = await patientRecord(tx)
			await tx`SET LOCAL ROLE ${tx(API_ROLE)}`
			const first = await newFinding(tx, record)
			const withdrawn = await newFinding(tx, record)
			const next = await newFinding(tx, record)
			const firstDraft = await draftOf(tx, record, first)
			await draftOf(tx, record, withdrawn)
			const nextDraft = await draftOf(tx, record, next)

			await close(tx, firstDraft)
			await close(tx, nextDraft)
			await close(tx, await draftOf(tx, record, first))

			const numbers = [
				await woundNumberOf(tx, first),
				await woundNumberOf(tx, withdrawn),
				await woundNumberOf(tx, next),
			]
			expect(numbers).toEqual([1, null, 2])
			await expect(
				tx.savepoint((point) => point`UPDATE finding SET wound_number = 9 WHERE id = ${first}`),
			).rejects.toThrow(REJECTED_CHANGE)
			await expect(
				tx.savepoint((point) => point`UPDATE patient_cache SET last_wound_number = 0 WHERE id = ${record.patientId}`),
			).rejects.toThrow(REJECTED_CHANGE)
		})
	})

	it("keeps the number of a wound a restore of the data brings", async () => {
		await rolledBack(async (tx) => {
			const record = await patientRecord(tx)
			const restored = await newFinding(tx, record, RESTORED_WOUND_NUMBER)

			await tx`UPDATE acquisition SET finding_id = ${restored} WHERE id = ${record.acquisitionId}`

			expect(await woundNumberOf(tx, restored)).toBe(RESTORED_WOUND_NUMBER)
		})
	})
})
