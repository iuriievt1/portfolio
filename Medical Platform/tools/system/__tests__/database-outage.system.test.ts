import { DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PhoneProblemError } from "../phone/phone"
import { submittedPhotoRecord } from "../phone/photo-record"
import { signedInPhone } from "../phone/signed-in-phone"
import { settledDeliveryOf } from "../server/delivery"
import {
	type ContainerState,
	containerStateOf,
	databaseLogSince,
	healthOf,
	isClinicalRecordStoreReady,
	type ProcessHealth,
	startDatabase,
	stopDatabase,
} from "../server/processes"
import { systemContext } from "../support/context"
import { eventually } from "../support/eventually"
import {
	DELIVERY_TIMEOUT_MILLISECONDS,
	ONE_FILE,
	OUTAGE_TIMEOUT_MILLISECONDS,
	RECOVERY_TIMEOUT_MILLISECONDS,
} from "../support/limits"

// quality/data/synteticka-sada/registry.json
const PATIENT_CODE = "1000103"
const CLINICIAN_LABEL = "system-outage"
// db/roles/roles.sql
const PROCESS_ROLES = ["vulna_api", "vulna_worker"]
const IDLE_IN_TRANSACTION_TIMEOUT = "1ms"
const IDLE_IN_TRANSACTION_TERMINATION = "terminating connection due to idle-in-transaction timeout"
const HTTP_SERVER_ERROR = 500
const NO_ACQUISITIONS = 0
// datovy-model.md 4, CAP-023-R28
const OPEN_STATES: readonly string[] = [ACQUISITION_STATE.DRAFT]

// CAP-028-S08
function isRefusedDuringOutage(error: unknown): boolean {
	if (error instanceof PhoneProblemError) {
		return error.status >= HTTP_SERVER_ERROR
	}
	return error instanceof TypeError
}

describe("CAP-028-S08 the database ends the connections of both processes", () => {
	const context = systemContext()
	const { environment, sql } = context
	const surveillanceUrls = [environment.apiSurveillanceUrl, environment.workerSurveillanceUrl]
	const containers = [environment.apiContainer, environment.workerContainer]
	let containersBefore: ContainerState[]

	async function healthOfBoth(): Promise<ProcessHealth[]> {
		return await Promise.all(surveillanceUrls.map(healthOf))
	}

	async function bothReady(): Promise<void> {
		await eventually(
			"both processes ready",
			healthOfBoth,
			(health) => health.every((process) => process.isLive && process.isReady),
			RECOVERY_TIMEOUT_MILLISECONDS,
		)
	}

	async function terminatedRoles(): Promise<string[]> {
		const rows = await sql<{ usename: string }[]>`
			WITH process_backend AS MATERIALIZED (
				SELECT pid, usename FROM pg_stat_activity
				WHERE datname = current_database() AND usename = ANY(${PROCESS_ROLES})
			)
			SELECT usename FROM process_backend WHERE pg_terminate_backend(pid)
		`
		return [...new Set(rows.map((row) => row.usename))].sort()
	}

	// db/roles/roles.sql
	async function setIdleInTransactionTimeout(value: string | undefined): Promise<void> {
		const setting =
			value === undefined
				? "RESET idle_in_transaction_session_timeout"
				: `SET idle_in_transaction_session_timeout = '${value}'`
		for (const role of PROCESS_ROLES) {
			await sql.unsafe(`ALTER ROLE "${role}" IN DATABASE "${environment.databaseName}" ${setting}`)
		}
	}

	async function receivedPhotoRecord(): Promise<string> {
		const signedIn = await signedInPhone(sql, environment.apiUrl, CLINICIAN_LABEL)
		return (await submittedPhotoRecord(signedIn, PATIENT_CODE)).acquisitionId
	}

	async function recordArrivingDuring(outage: () => Promise<void>): Promise<string[]> {
		const received = [await receivedPhotoRecord()]
		const signedIn = await signedInPhone(sql, environment.apiUrl, CLINICIAN_LABEL)
		const arriving = submittedPhotoRecord(signedIn, PATIENT_CODE).then(
			(record) => received.push(record.acquisitionId),
			(error: unknown) => {
				if (!isRefusedDuringOutage(error)) {
					throw error
				}
			},
		)
		await outage()
		await arriving
		await bothReady()
		await eventually(
			"the clinical record store ready",
			() => isClinicalRecordStoreReady(environment.clinicalRecordUrl),
			(isReady) => isReady,
			RECOVERY_TIMEOUT_MILLISECONDS,
		)
		received.push(await receivedPhotoRecord())
		return received
	}

	async function expectNoRestart(): Promise<void> {
		expect(await Promise.all(containers.map(containerStateOf))).toEqual(containersBefore)
	}

	async function expectNothingLost(acquisitionIds: readonly string[]): Promise<void> {
		const [orphaned] = await sql<{ count: number }[]>`
			SELECT count(*)::integer AS count FROM acquisition a
			WHERE NOT (a.state = ANY(${OPEN_STATES}))
				AND NOT EXISTS (SELECT 1 FROM delivery d WHERE d.acquisition_id = a.id)
		`
		expect(orphaned?.count).toBe(NO_ACQUISITIONS)
		for (const acquisitionId of acquisitionIds) {
			const delivered = await settledDeliveryOf(sql, acquisitionId, ONE_FILE, DELIVERY_TIMEOUT_MILLISECONDS)

			expect(delivered.map((instance) => instance.state)).toEqual([DELIVERY_INSTANCE_STATE.CONFIRMED])
		}
	}

	beforeAll(async () => {
		await bothReady()
		containersBefore = await Promise.all(containers.map(containerStateOf))
		expect(containersBefore.every((container) => container.isRunning)).toBe(true)
	})

	afterAll(async () => {
		await startDatabase()
		await setIdleInTransactionTimeout(undefined)
		await terminatedRoles()
		await context.close()
	})

	it("CAP-028-S08 keeps both processes going after pg_terminate_backend", async () => {
		let terminated: string[] = []
		const received = await recordArrivingDuring(async () => {
			terminated = await terminatedRoles()
		})

		expect(terminated).toEqual(PROCESS_ROLES)
		await expectNoRestart()
		await expectNothingLost(received)
	})

	it("CAP-028-S08 keeps both processes going after idle_in_transaction_session_timeout ends a transaction", async () => {
		const since = new Date()
		let log = ""
		const received = await recordArrivingDuring(async () => {
			try {
				await setIdleInTransactionTimeout(IDLE_IN_TRANSACTION_TIMEOUT)
				await terminatedRoles()
				log = await eventually(
					"a transaction ended by idle_in_transaction_session_timeout",
					() => databaseLogSince(since),
					(text) => text.includes(IDLE_IN_TRANSACTION_TERMINATION),
					OUTAGE_TIMEOUT_MILLISECONDS,
				)
			} finally {
				await setIdleInTransactionTimeout(undefined)
				await terminatedRoles()
			}
		})

		expect(log).toContain(IDLE_IN_TRANSACTION_TERMINATION)
		await expectNoRestart()
		await expectNothingLost(received)
	})

	it("CAP-028-S08 keeps both processes live but not ready while the database restarts", async () => {
		let healthWhileDown: ProcessHealth[] = []
		const received = await recordArrivingDuring(async () => {
			await stopDatabase()
			try {
				healthWhileDown = await eventually(
					"both processes not ready",
					healthOfBoth,
					(health) => health.every((process) => !process.isReady),
					OUTAGE_TIMEOUT_MILLISECONDS,
				)
			} finally {
				await startDatabase()
			}
		})

		expect(healthWhileDown).toEqual([
			{ isLive: true, isReady: false },
			{ isLive: true, isReady: false },
		])
		await expectNoRestart()
		await expectNothingLost(received)
	})
})
