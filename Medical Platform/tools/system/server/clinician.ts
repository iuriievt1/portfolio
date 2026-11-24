import { randomBytes, randomUUID } from "node:crypto"
import { ROLE } from "@ansora/contracts"
import {
	DEVICE_PLATFORM,
	DEVICE_STATE,
	JOB_KIND,
	JOB_OBJECT_KIND,
	JOB_STATE,
	QueueTaskStore,
	SECURE_HARDWARE,
	sha256Hex,
} from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import type { DeviceKey } from "../phone/device-key"
import { eventually } from "../support/eventually"
import { ACTOR_TIMEOUT_MILLISECONDS } from "../support/limits"

// ADR-024, Q-040
const DEPARTMENT_CODE = "SYSTEM-TEST"
const MANUAL_ROLE_ORIGIN = "manual"
const DEVICE_MODEL = "System test phone"
const DEVICE_OS_VERSION = "system-test"
const TOKEN_BYTES = 32
const TOKEN_ENCODING = "base64url"
const SESSION_HOURS = 8
const TOKEN_MINUTES = 60
const MILLISECONDS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const GIVEN_NAME = "Systémová"
const FAMILY_NAME = "Sestra"
const IS_MANAGED_CONFIGURATION = false
const SETTLED_TASK_STATES: readonly string[] = [JOB_STATE.DONE, JOB_STATE.FAILED]

export interface Clinician {
	userId: string
	sessionId: string
	sessionToken: string
	deviceId: string
}

function minutesFromNow(minutes: number): Date {
	return new Date(Date.now() + minutes * MILLISECONDS_PER_MINUTE)
}

// CAP-021-S33, CAP-001-R31
async function actorWritten(sql: postgres.Sql, userId: string): Promise<void> {
	const state = await eventually(
		`the actor of user ${userId} in the clinical record store`,
		async () => {
			const [task] = await sql<{ state: string }[]>`
				SELECT state FROM queue_task
				WHERE kind = ${JOB_KIND.CLINICAL_RECORD_WRITE} AND object_kind = ${JOB_OBJECT_KIND.ACTOR} AND object_id = ${userId}
				ORDER BY created_at DESC LIMIT 1
			`
			return task?.state
		},
		(current) => current !== undefined && SETTLED_TASK_STATES.includes(current),
		ACTOR_TIMEOUT_MILLISECONDS,
	)
	if (state !== JOB_STATE.DONE) {
		throw new Error(`the actor of user ${userId} was not written: ${state}`)
	}
}

// ADR-024, CAP-003-R03, ADR-013, CAP-001-R31, CAP-021-R38
export async function enrolledClinician(sql: postgres.Sql, key: DeviceKey, label: string): Promise<Clinician> {
	const personalNumber = `${label}-${randomUUID()}`
	const userId = randomUUID()
	const deviceId = randomUUID()
	const sessionId = randomUUID()
	const sessionToken = randomBytes(TOKEN_BYTES).toString(TOKEN_ENCODING)
	const queue = new QueueTaskStore({ sql })
	await sql.begin(async (tx) => {
		const [department] = await tx<{ id: string }[]>`
			INSERT INTO department (id, code) VALUES (${randomUUID()}, ${DEPARTMENT_CODE})
			ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
			RETURNING id
		`
		if (department === undefined) {
			throw new Error(`the department ${DEPARTMENT_CODE} was not written`)
		}
		await tx`
			INSERT INTO app_user (id, given_name, family_name, display_name, personal_number, department_id)
			VALUES (${userId}, ${GIVEN_NAME}, ${FAMILY_NAME}, ${`${GIVEN_NAME} ${FAMILY_NAME}`}, ${personalNumber},
				${department.id})
		`
		await tx`INSERT INTO user_role (user_id, role, origin) VALUES (${userId}, ${ROLE.CLINICIAN}, ${MANUAL_ROLE_ORIGIN})`
		await tx`
			INSERT INTO user_department_history (id, user_id, department_id, valid_from)
			VALUES (${randomUUID()}, ${userId}, ${department.id}, now())
		`
		await tx`
			INSERT INTO device (id, state, public_key_jwk, hw_id, model, os_version, platform, secure_hardware,
				managed_configuration)
			VALUES (${deviceId}, ${DEVICE_STATE.APPROVED}, ${tx.json({ ...key.publicKeyJwk })}, ${key.hardwareId},
				${DEVICE_MODEL}, ${DEVICE_OS_VERSION}, ${DEVICE_PLATFORM.ANDROID}, ${SECURE_HARDWARE.STRONGBOX},
				${IS_MANAGED_CONFIGURATION})
		`
		await tx`
			INSERT INTO session (id, user_id, device_id, token_hash, expires_at, session_end, token_issued_at)
			VALUES (${sessionId}, ${userId}, ${deviceId}, ${sha256Hex(sessionToken)}, ${minutesFromNow(TOKEN_MINUTES)},
				${minutesFromNow(SESSION_HOURS * MINUTES_PER_HOUR)}, now())
		`
		await queue.enqueue(tx, {
			kind: JOB_KIND.CLINICAL_RECORD_WRITE,
			objectKind: JOB_OBJECT_KIND.ACTOR,
			objectId: userId,
		})
	})
	await actorWritten(sql, userId)
	return { userId, sessionId, sessionToken, deviceId }
}
