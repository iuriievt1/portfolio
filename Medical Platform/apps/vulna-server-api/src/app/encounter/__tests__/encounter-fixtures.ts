import { ACQUISITION_KIND, ENCOUNTER_STATUS, PATIENT_SEX } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import type { EncounterRow } from "../types/encounter.types"

export const NOW = new Date("2026-10-07T08:00:00Z")
export const TODAY = "2026-10-07"
export const USER = "11111111-1111-4111-8111-111111111111"
export const OTHER_USER = "22222222-2222-4222-8222-222222222222"
export const SESSION = "33333333-3333-4333-8333-333333333333"
export const DEVICE = "44444444-4444-4444-8444-444444444444"
export const PATIENT = "55555555-5555-4555-8555-555555555555"
export const OTHER_PATIENT = "66666666-6666-4666-8666-666666666666"
export const DEPARTMENT = "77777777-7777-4777-8777-777777777777"
export const ENCOUNTER = "88888888-8888-4888-8888-888888888888"

export const CURRENT = {
	session: { id: SESSION, userId: USER, deviceId: DEVICE },
	token: "token",
	device: { id: DEVICE },
} as unknown as CurrentSession

export function foundPatient(id = PATIENT): FoundPatient {
	return {
		patient: { id, sex: PATIENT_SEX.FEMALE },
		identifiers: [{ patient_id: id, system: "mou-nis", value: `nis-${id.slice(0, 4)}`, issuer: "MOU" }],
	}
}

export function encounterRow(overrides: Partial<EncounterRow> = {}): EncounterRow {
	return {
		id: ENCOUNTER,
		patient_id: PATIENT,
		source: "created_in_app",
		status: ENCOUNTER_STATUS.IN_PROGRESS,
		date: TODAY,
		scheduled_time: null,
		department_id: DEPARTMENT,
		started_at: NOW,
		encounter_key: "99999999-9999-4999-8999-999999999999",
		completed_at: null,
		completed_by: null,
		study_instance_uid: "2.25.1",
		accession_number: null,
		status_changed_at: NOW,
		created_at: NOW,
		...overrides,
	}
}

export function acquisitionRow(overrides: Partial<AcquisitionRow> = {}): AcquisitionRow {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		patient_id: PATIENT,
		encounter_id: ENCOUNTER,
		finding_id: null,
		kind: ACQUISITION_KIND.PHOTO,
		state: ACQUISITION_STATE.DRAFT,
		operator_user_id: USER,
		department_id: DEPARTMENT,
		configuration_version_id: 3,
		started_at: new Date("2026-10-07T07:59:00Z"),
		closed_at: null,
		file_count: null,
		version: 1,
		updated_at: NOW,
		...overrides,
	}
}

export function fakeDatabase(): DatabaseService {
	const tx = (async () => []) as unknown as postgres.TransactionSql
	const sql = Object.assign(async () => [], {
		begin: async (work: (transaction: postgres.TransactionSql) => Promise<unknown>) => await work(tx),
	})
	return { sql } as unknown as DatabaseService
}

export async function problemOf(work: Promise<unknown>): Promise<ProblemException> {
	const error = await work.then(
		() => undefined,
		(reason: unknown) => reason,
	)
	if (!(error instanceof ProblemException)) {
		throw new Error(`expected a problem response, got ${String(error)}`)
	}
	return error
}
